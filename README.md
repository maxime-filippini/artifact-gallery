# Artifact Gallery

A private catalog for agent-built review artifacts.

This repository is a Bun workspace containing separate Gallery and Artifact
Server applications. They have independent runtime configuration and security
boundaries, while sharing the artifact contract and deployment documentation.

## Artifact Server

The Artifact Server is the deliberately narrow static service that exposes files
from an Artifact Library. It binds only to `127.0.0.1` on port `8766` by
default, serves regular non-symlink files only, has no directory listings or
CORS, and prevents `.hidden` paths from being served.

```sh
ARTIFACT_LIBRARY="$HOME/dev/review-artifacts" bun run artifact-server
```

Set `ARTIFACT_PORT` to use a different loopback port; use `0` to have the OS
select a free port. See the
[publishing contract](docs/artifact-contract.md) for the supported Artifact
Library layout.

Run the automated checks with:

```sh
bun test
```
