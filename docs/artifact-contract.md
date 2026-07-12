# Review artifact publishing contract

Publish each review artifact as a direct child of `~/dev/review-artifacts` (or the configured `ARTIFACT_LIBRARY`).

```text
~/dev/review-artifacts/
  risk-report-2026-07-12/
    index.html
    artifact.json          # optional
    data.json              # optional
    styles.css             # optional
    thumbnail.png          # optional
```

## Required layout

- One artifact is one directory containing `index.html`.
- Directory names use lowercase letters, digits, and hyphens only.
- Names are unique across both active artifacts and `.reviewed`.
- Do not create symbolic links.
- Do not use `.reviewed` or `.hidden`; the gallery owns those reserved directories.

## Optional metadata

`artifact.json` may contain only optional `title`, `description`, and `thumbnail` fields. `thumbnail` is a relative path inside the artifact directory. Without metadata, the gallery derives the title from the directory name and shows a fallback preview.

```json
{
  "title": "Risk report — 12 July",
  "description": "Interactive scenario review",
  "thumbnail": "thumbnail.png"
}
```

## Resource policy

- Prefer files in the artifact directory for data and assets.
- Inline HTML, CSS, and JavaScript are supported.
- Static dependencies may be loaded from `https://cdn.jsdelivr.net`.
- Do not make arbitrary external API or data requests.

An artifact becomes visible once its `index.html` exists. Missing or malformed metadata does not prevent it from being listed.
