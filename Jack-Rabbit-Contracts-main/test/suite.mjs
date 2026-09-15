// Register all cases in one worker so the pinned Solidity build is compiled once.
// Each EVM test still creates and closes its own isolated chain.
import fs from 'node:fs';
const tests = fs.readdirSync(new URL('.', import.meta.url)).filter(name => name.endsWith('.test.mjs')).sort();
for (const name of tests) await import(new URL(name, import.meta.url));
