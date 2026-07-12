# Allow approved static CDN dependencies in artifacts

Review Artifacts may use inline scripts and styles and may load static scripts, styles, fonts, and other resources from the explicitly approved jsDelivr CDN. The Artifact Server's content policy otherwise permits only same-origin resources and blocks external connections, so agents can use charting libraries without granting artifacts arbitrary network access.
