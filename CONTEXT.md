# Artifact Gallery

Artifact Gallery is a private catalog for visually reviewing interactive files created by agents on a laptop. It is available only to the owner's Tailscale-connected devices, including a phone.

## Language

**Artifact Gallery**:
The private application used to discover and link to review artifacts; it does not render artifact content.
_Avoid_: portal, dashboard

**Review Artifact**:
An agent-authored, browser-rendered deliverable intended for visual review across the owner's devices. It has an HTML entry point and may include JSON, CSS, JavaScript, and assets.
_Avoid_: document, asset

**Artifact Library**:
The filesystem directory containing the review artifacts available to the gallery.
_Avoid_: file server, artifact folder

**Artifact Directory**:
An immediate child directory of the Artifact Library that represents exactly one Review Artifact. Its `index.html` is the artifact's entry point and its lowercase, hyphenated URL-safe directory name is its initial display title. Its name is unique across the Review Queue and Review Archive.
_Avoid_: project directory, artifact bundle

**Artifact Metadata**:
Optional `artifact.json` data in an Artifact Directory that provides the artifact's title, description, and a same-directory thumbnail. When absent, the gallery derives a title from the directory name and uses a styled fallback preview.
_Avoid_: manifest, front matter

**Artifact Index**:
The gallery's current catalog of Artifact Directories with an `index.html` entry point. It is derived from the Artifact Library when viewed rather than maintained through a separate publishing step.
_Avoid_: registry, database

**Review Queue**:
Review Artifacts that have not yet been marked reviewed. These are prioritized in the Artifact Index.
_Avoid_: inbox, active list

**Review Archive**:
Review Artifacts that have been marked reviewed and remain available for later reference.
_Avoid_: history, completed list

**Restore**:
Returning a Review Artifact from the Review Archive to the Review Queue.
_Avoid_: unreview, reopen

**Hidden Artifact**:
A Review Artifact intentionally retained in the Artifact Library but excluded from the Artifact Index.
_Avoid_: deleted artifact, private artifact

**Artifact Origin**:
The externally reachable, separately hosted web origin from which Review Artifacts are opened.
_Avoid_: localhost URL, artifact path

**Artifact Server**:
The static web service that serves Review Artifacts from the Artifact Library at the Artifact Origin. It is not an artifact-discovery interface.
_Avoid_: gallery backend, directory browser
