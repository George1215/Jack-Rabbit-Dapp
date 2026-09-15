# Jack Rabbit dapp

React/Vite interface for the Jack Rabbit ecosystem on PulseChain. Preserves the original rabbit artwork and orange comic style.

```sh
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
npm run build
npm run lint
```

Pages: Overview, Diamond Hands, Jackies, Farm, Mining, Barrow, Runner and Treasury. Legacy `/dapp/` and `/dapp/jackies.html` URLs redirect into the app.

JACK's identified address is in `src/protocol.js`. Ecosystem module deployments have not been verified, so financial actions are disabled. Connecting an injected wallet permits only a JACK balance read on PulseChain; the app does not request token approvals or financial transactions.

See [frontend status and verification](docs/frontend/IMPLEMENTATION.md), [economic blueprint](docs/economics/BLUEPRINT.md), and [contract implementation evidence](docs/economics/IMPLEMENTATION.md).

Contract tests have a separate toolchain under `Jack-Rabbit-Contracts-main`:

```sh
cd Jack-Rabbit-Contracts-main
npm ci --ignore-scripts --omit=optional
npm test
npm run compile
```

No push or deployment is part of the local development workflow.
