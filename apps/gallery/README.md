# Gallery application

The Gallery application owns artifact discovery and review-state changes. It
does not render artifact content: each card opens the configured Artifact
Origin in a separate origin.

```sh
ARTIFACT_LIBRARY="$HOME/dev/review-artifacts" \
ARTIFACT_ORIGIN="https://artifacts.example.ts.net" \
bun run start
```

It binds to `127.0.0.1:8765` by default. Set `GALLERY_PORT` to use another
loopback port; use `0` to let the OS choose one.
