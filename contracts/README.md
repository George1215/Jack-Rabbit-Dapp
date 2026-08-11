# Jack Rabbit contracts

This directory contains the current coherent Jack Rabbit core contract set recovered from the project source history for launch preparation.

## Core contracts

- `JackToken.sol` — JACK ERC-20, dynamic transfer fee, automatic fee burn, treasury routing, burn-linked minting.
- `JackTreasury.sol` — protocol treasury, JACK accounting, pDAI protected reserves, swap-token intake, holding-token custody, LP custody, protocol requests, and five-year rolling accounting.
- `JackStake.sol` — JACK/external-token staking and reward accounting.
- `JackMining.sol` — weekly JACK mining/reward engine with organic and treasury-funded modes.
- `JackFarm.sol` — LP farm/reward engine.

## Interfaces

- `interfaces/IJack.sol`
- `interfaces/IJackTreasury.sol`
- `interfaces/IWPLS.sol`
- `interfaces/IPulseXRouter02.sol`

## Launch status

The source set is intentionally separated from deployment artifacts. Do not treat a Git commit as a production deployment or security audit.

Before mainnet deployment:

1. Compile the full set together against a compatible OpenZeppelin Contracts 5.x toolchain.
2. Add unit/integration tests for fee-on-transfer accounting, treasury reserve isolation, authorization, staking rewards, mining week rollover, and farm accounting.
3. Run static/security analysis and an independent smart-contract review.
4. Deploy to a PulseChain test environment and execute the full DApp transaction flow.
5. Generate final ABIs from the exact deployment build and update the frontend addresses/ABIs from those artifacts.

`JackBarrow` / bond-engine drafts are not included in this core launch set because the latest recovered Barrow draft targets an older Treasury API and must be reconciled before it can be considered deployable.
