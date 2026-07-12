# Gallery application

The Gallery application owns artifact discovery and review-state changes. It
does not render artifact content: each card opens the configured Artifact
Origin in a separate origin.

Build and serve the production app from the repository root:

```sh
ARTIFACT_LIBRARY="$HOME/dev/review-artifacts" \
ARTIFACT_ORIGIN="https://artifacts.example.ts.net" \
bun run gallery
```

It binds to `127.0.0.1:8765` by default. Set `GALLERY_PORT` to use another
loopback port; use `0` to let the OS choose one.

For local UI development, run the API command above in one terminal, then run
the Vite client in another:

```sh
bun run gallery:dev
```

Vite serves the mobile React interface at `http://127.0.0.1:5173` and proxies
`/api` requests to the Gallery API.
