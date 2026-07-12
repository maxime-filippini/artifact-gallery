# Rely on Tailscale for access control

The gallery and Artifact Server have no application-level login in v1. Tailscale Serve exposes them only within the owner's Tailnet, where device and user access are controlled by Tailscale policy; the gallery still protects state-changing requests from cross-site actions.
