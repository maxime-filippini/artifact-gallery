# Configure the artifact origin explicitly

The gallery receives the Artifact Origin through deployment configuration and uses it to construct review links. It does not infer that address from its own request origin, because artifacts must be reachable from Tailscale-connected devices rather than only from the laptop running the services.
