# likho-mfe-library

The recordings library of the Likho web app: every call of the workspace with where it stands,
uploads (files, drag and drop, or a recording from the microphone), filters, search, and the way
into each transcript. Loaded by [likho-web-shell](https://github.com/likho-ai/likho-web-shell) at
`/recordings` through Module Federation; this repository exposes `./App`.

React 19, Vite 8, Tailwind CSS v4 with the likho-ui tokens, likho-web-sdk.

## What it does

- Lists recordings newest first, page by page, with status chips, the facts of the call (campaign
  and disposition, agent, when the call was made), language and probability, and length. The list
  stays current while the page is open (server-sent events).
- Filters by status, searches by file name or external id, and narrows by campaign, agent and the
  days of the calls (the values with their counts come from likho-api; the choice is in the
  address, so a narrowed library can be shared).
- Uploads: several files at once with per-file progress; a file whose content is already there
  points at the earlier upload; a recording made from the microphone is uploaded like a file.
- Starts a job by hand (when auto-transcribe is off), cancels a queued one.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:5174/mfe/library/ on its own, against the gateway's API
```

In the product the shell loads `/mfe/library/remoteEntry.js`; `pnpm dev` here plus `pnpm dev` in the
shell gives the real layout through http://localhost:8080.

## Develop

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm build
docker build -t likho-mfe-library .    # nginx serving the built files under /mfe/library/
```

Settings: `.env.development`, `.env.staging`, `.env.production` (Vite modes). The stylesheet is
scoped under `[data-mfe="library"]` (see `vite.config.ts`), so its classes never affect the shell.
