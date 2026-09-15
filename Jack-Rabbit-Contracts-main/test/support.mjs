import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let compiled;

export function compile() {
  if (compiled) return compiled;
  const sources = {};
  for (const name of fs.readdirSync(path.join(root, 'contracts'))) {
    if (name.endsWith('.sol')) {
      sources[`contracts/${name}`] = { content: fs.readFileSync(path.join(root, 'contracts', name), 'utf8') };
    }
  }
  sources['test/fixtures/ProtocolFixtures.sol'] = {
    content: fs.readFileSync(path.join(root, 'test/fixtures/ProtocolFixtures.sol'), 'utf8'),
  };
  if (process.env.JACK_REGRESSION_BASELINE) {
    const baseline = JSON.parse(fs.readFileSync(path.resolve(root, process.env.JACK_REGRESSION_BASELINE), 'utf8'));
    for (const name of ['contracts/JackStake.sol', 'contracts/JackBarrow.sol']) sources[name] = baseline[name];
  }
  function findImports(name) {
    let resolved;
    if (name.startsWith('@openzeppelin/contracts@4.9.5/')) {
      resolved = path.join(root, 'node_modules/openzeppelin-v4', name.slice('@openzeppelin/contracts@4.9.5/'.length));
    } else if (name.startsWith('@openzeppelin/')) {
      resolved = path.join(root, 'node_modules', name);
    } else resolved = path.join(root, name);
    try { return { contents: fs.readFileSync(resolved, 'utf8') }; }
    catch { return { error: `Import not found: ${name}` }; }
  }
  const emitted = ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'];
  const treasuryViaIR = process.env.JACK_TREASURY_LEGACY !== '1';
  const selection = Object.fromEntries(Object.keys(sources).map(name => [name, {
    '*': treasuryViaIR && name === 'contracts/JackTreasury.sol' ? ['abi'] : emitted,
  }]));
  const input = {
    language: 'Solidity', sources,
    settings: {
      optimizer: { enabled: true, runs: Number(process.env.JACK_OPTIMIZER_RUNS ?? 1) }, evmVersion: 'paris',
      outputSelection: selection,
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors ?? []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  // Treasury's existing source is over EIP-170 even at one optimizer run.
  // Compile that deployment unit through IR; never disable the EVM size limit.
  if (treasuryViaIR) {
    const treasuryInput = {
      ...input, settings: { ...input.settings, viaIR: true,
        outputSelection: { 'contracts/JackTreasury.sol': { JackTreasury: emitted } },
      },
    };
    const treasuryOutput = JSON.parse(solc.compile(JSON.stringify(treasuryInput), { import: findImports }));
    const treasuryErrors = (treasuryOutput.errors ?? []).filter(e => e.severity === 'error');
    if (treasuryErrors.length) throw new Error(treasuryErrors.map(e => e.formattedMessage).join('\n'));
    output.contracts['contracts/JackTreasury.sol'] = treasuryOutput.contracts['contracts/JackTreasury.sol'];
    output.supersededWarnings = (output.errors ?? []).filter(e => e.errorCode === '5574' && e.sourceLocation?.file === 'contracts/JackTreasury.sol');
    output.errors = [...(output.errors ?? []).filter(e => !output.supersededWarnings.includes(e)), ...(treasuryOutput.errors ?? [])];
  }
  compiled = output;
  return compiled;
}

export function artifact(name) {
  const matches = Object.values(compile().contracts).flatMap(file => Object.entries(file))
    .filter(([contract]) => contract === name);
  if (matches.length !== 1) throw new Error(`Expected one artifact for ${name}, got ${matches.length}`);
  return matches[0][1];
}

export async function chain() {
  const { default: ganache } = await import('ganache');
  const { BrowserProvider } = await import('ethers');
  const rpc = ganache.provider({
    logging: { quiet: true }, wallet: { deterministic: true, totalAccounts: 10 },
    chain: { hardfork: 'shanghai', time: new Date('2026-09-08T00:00:00Z') },
    miner: { timestampIncrement: 0 },
  });
  const provider = new BrowserProvider(rpc, undefined, { cacheTimeout: -1 });
  provider.pollingInterval = 10;
  const signers = await Promise.all(Array.from({ length: 10 }, (_, i) => provider.getSigner(i)));
  return { rpc, provider, signers, close: async () => { provider.destroy(); await rpc.disconnect(); } };
}

export async function deploy(name, signer, args = []) {
  const { ContractFactory } = await import('ethers');
  const a = artifact(name);
  const size = a.evm.deployedBytecode.object.length / 2;
  if (size > 24576) throw new Error(`${name}: ${size} bytes exceeds EIP-170`);
  try {
    const contract = await new ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args);
    await contract.waitForDeployment();
    return contract;
  } catch (error) { throw new Error(`${name} deployment failed: ${error.shortMessage ?? error.message}`, { cause: error.info?.error?.message }); }
}

export async function send(tx) { return (await tx).wait(); }
export async function advance(rpc, seconds) {
  await rpc.request({ method: 'evm_increaseTime', params: [seconds] });
  await rpc.request({ method: 'evm_mine', params: [] });
}
