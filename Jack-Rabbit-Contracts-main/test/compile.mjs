import fs from 'node:fs';
import path from 'node:path';
import { compile, root } from './support.mjs';

const output = compile();
const report = { compiler: '0.8.24', evmVersion: 'paris', optimizerRuns: Number(process.env.JACK_OPTIMIZER_RUNS ?? 1),
  treasuryViaIR: process.env.JACK_TREASURY_LEGACY !== '1', runtimeBytes: {},
  supersededLegacyWarnings: output.supersededWarnings ?? [] };
for (const warning of output.errors ?? []) console.warn(warning.formattedMessage);
for (const [file, contracts] of Object.entries(output.contracts)) {
  if (!file.startsWith('contracts/') || file.includes('/interfaces/')) continue;
  for (const [name, artifact] of Object.entries(contracts)) {
    const size = artifact.evm.deployedBytecode.object.length / 2;
    if (!size) continue;
    report.runtimeBytes[name] = size;
    console.log(`${name}: ${size} runtime bytes${size > 24576 ? ' — exceeds EIP-170 limit' : ''}`);
    if (size > 24576) process.exitCode = 1;
  }
}
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/compile-report.json'), JSON.stringify(report, null, 2) + '\n');
