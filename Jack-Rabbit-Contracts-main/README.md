# Jack Rabbit Contracts

Authoritative smart-contract source for the Jack Rabbit ecosystem.

This repository is intentionally separate from `Jack-Rabbit-Dapp`.

## Structure

- `contracts/` — protocol contracts
- `contracts/interfaces/` — shared interfaces
- `contracts/testHelpers/` — Solidity test helpers
- `tests/` — Solidity test suite
- `scripts/` — deployment helpers
- `remix.config.json` — Remix configuration

Generated build artifacts and local metadata are intentionally excluded from source control.

## Local contract tests

The `test/` directory contains executable Node/EVM regression and integration tests;
the existing `tests/` directory contains the separate Remix test sources.

```sh
npm ci --ignore-scripts --omit=optional
npm test
npm run compile
```

Dependencies are pinned in this folder's package files, independently of the dapp.
The compile command checks runtime bytecode sizes and writes an ignored report to
`artifacts/compile-report.json`. Local tests enforce the normal contract-size limit.

**Remix:** use Solidity 0.8.24, Paris, optimizer enabled with **1 run** for the
undeployed contracts. **For JackTreasury, additionally enable viaIR**; disable it
again when building the other contracts. The exact profiles are recorded in
`compiler-profiles.json`. Several original builds exceed the size limit at 200
runs, and Treasury still exceeds it at one run without viaIR. Do not redeploy or
change the existing JACK token; its explorer-reported build uses 200 runs.

Unversioned OpenZeppelin imports resolve to 5.0.2 in local tests. Imports explicitly
qualified with 4.9.5 use that version. Pin the same resolutions in Remix rather than
allowing a newer major/minor library to change the bytecode or API unexpectedly.

See [revenue distributor behavior and integration](REVENUE-DISTRIBUTOR.md),
[economic blueprint](../docs/economics/BLUEPRINT.md), and the public JACK metadata
record at `../docs/deployments/jack-token-verification.json`.

See [Runner and peg reserve maintenance](RUNNER-AND-RESERVE.md) for the new isolated capital and operator reward contracts. Neither implements peg trading.

See [revenue flows and lifecycle scenarios](../docs/economics/REVENUE-FLOWS.md) for draft allocations, funding prerequisites and the offline review planner.

See [validated Mining valuation and Runner budgets](../docs/economics/VALUATION-AND-OPERATIONS.md) for the compatible Oracle Hub API, tested price failures, fallback tradeoff and offline operating-cost scenarios.
