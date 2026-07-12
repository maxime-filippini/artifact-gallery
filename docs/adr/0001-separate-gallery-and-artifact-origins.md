# Separate gallery and artifact origins

The Artifact Gallery indexes review artifacts but links to their HTML entry points on a separately hosted artifact-server origin. This lets the gallery remain a safe catalog while artifact JavaScript executes outside its origin, which is important because artifacts are agent-authored and interactive. The artifact server does not enable CORS for the gallery: the gallery reads the local Artifact Library on its backend, and the browser crosses origins only by navigation.
