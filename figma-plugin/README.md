# HUDI Orb Library — local Figma plugin

This local development plugin inserts the 37 company-logo orbs as SVG-derived Figma layers. It loads the validated local asset set—primarily Logo.dev snapshots with curated official sources where needed—embeds each mark as a data URL, and then creates the orb SVG so inserted artwork does not depend on an external image URL after insertion.

## Build

From the repository root:

```bash
NEXT_PUBLIC_LOGO_DEV_TOKEN=pk_your_publishable_key npm run build:figma
```

SVG is the default Logo.dev format and requires a Logo.dev Enterprise plan. Add `NEXT_PUBLIC_LOGO_DEV_FORMAT=png` to build against a standard plan.

In Figma Desktop, choose **Plugins → Development → Import plugin from manifest…** and select `figma-plugin/manifest.json`. Rebuild after changing listing data, palettes, logo sizing, renderer geometry, or plugin UI code.

The generated `figma-plugin/dist/` directory is local-only and ignored by Git. The plugin is allowed to connect only to `https://img.logo.dev`.
