# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-27

### Added

- **Supporter plan** ($5/mo or $50/yr via Polar, merchant of record) with a
  public free-forever guarantee: everything a student needs for their IA stays
  free, unlimited, and watermark-free
- Accounts (email + password with one-time verification, or Google) via Supabase,
  optional and only needed for cloud features
- **Hosted AI** provider: server-side Gemini generation with no API key setup,
  metered at 150 generations/month per Supporter (BYOK stays unlimited & free).
  Three interchangeable backends, first configured wins: Vertex AI express key,
  Vertex AI with a project (ADC locally, service account on Vercel), or a
  Google AI Studio key
- **Account deletion** (`/api/delete-account`): permanently removes the account
  and all cloud data, cancelling any active subscription first so a deleted
  account can never keep being billed
- **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) pages,
  governed by Finnish law and preserving EU/EEA consumer rights
- **Database keepalive workflow** (`.github/workflows/db-keepalive.yml`): a cheap
  read every ~5 days so a free-tier Supabase project never pauses after 7 days
  of inactivity
- **Cloud sync** across devices: local-first, last-write-wins with deletion
  tombstones, plus automatic version history (restorable from the editor)
- **Shareable view-only links** for graphs and projects (`/s/:slug`), revocable,
  never including chat history
- **Custom template library**: save your own curve setups, synced to your account
- Pricing page (`/pricing`) and fact-checked comparison page (`/compare`)
- 12 prerendered SEO landing pages (`/diagrams/*`) with IB-specific content,
  generated at build time along with the sitemap
- **Per-account local storage**: each account that signs in on a browser gets
  its own local diagrams, alongside a shared one for work done signed out.
  Switching accounts on a shared computer no longer erases anyone's work.
  Signed-out work is handed to the account you sign into only when that account
  has no diagrams of its own, so two people's diagrams are never merged.
  Diagrams now live in IndexedDB (gigabytes) rather than localStorage (~5MB
  shared with the auth token), migrated automatically on first load
- Supporter recognition: opt-in name listing in the README
- Backend setup guide (`docs/BACKEND_SETUP.md`): all cloud features degrade
  gracefully when unconfigured, so forks stay zero-config

### Changed

- **Relicensed from MIT to AGPL-3.0.** Running a modified version as a network
  service now requires publishing the modified source to its users. The project
  name, logo, and branding are reserved separately and are not covered by the
  code license, so forks should run under their own branding
- Source-code offer linked from Settings, as required by AGPL-3.0 section 13
- Landing page: pricing/compare navigation, free-forever guarantee messaging,
  support/sponsor links
- Settings: new Account & Cloud section (plan status, hosted AI usage meter,
  sync controls, supporter preferences)
- Component templates now support text labels
- Renewal handling: entitlement is cushioned by a 1-day margin at the billing
  boundary and is never moved backward by a delayed or out-of-order webhook,
  while cancellation still ends access immediately
- Import/restore now asks for confirmation before overwriting existing data
- Em dashes and arrow glyphs removed from user-visible text throughout

### Security

- Version history is now capped in the database itself. `prune_graph_versions`
  clamps its caller-supplied keep count, and an insert trigger enforces a hard
  ceiling per graph, so a tampered client cannot grow `graph_versions` without
  bound by requesting a huge count or skipping the prune call entirely

## [1.0.0] - 2026-02-07

### Added

- AI-powered diagram generation using Google Gemini Models
- Manual drawing tools: lines, bezier curves, annotation points, text labels, area shading
- Component library with 15+ pre-built IB Economics templates (Supply & Demand, Monopoly, Tax Incidence, etc.)
- Project and graph management system with localStorage persistence
- SVG export for diagrams
- JSON import/export for full data backup and restore
- Customizable color palettes (special + standard colors)
- Smart snapping to grid and existing points
- Undo/redo history (up to 50 states)
- Keyboard shortcuts for tool selection and undo/redo
- Landing page with feature overview
- Settings page for API key and model management
- Box select and eraser tools
- Pan and zoom controls

<!--
Version headings are intentionally unlinked: no git tags or GitHub releases
exist yet, so `releases/tag/vX.Y.Z` links would 404. Add the link definitions
back once the versions are tagged.
-->
