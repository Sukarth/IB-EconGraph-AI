# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-10-04

### Fixed

- **A returning customer could pay and never become a Supporter.** Polar
  matches a checkout to an existing customer by email, and a customer's
  external id can never change. So someone who deleted their account and
  signed up again with the same email paid as their old customer, still
  carrying the deleted account's id: the payment was accepted, no account was
  upgraded, and the checkout screen waited forever. The same mix-up sent
  "Manage billing" to "No billing account found", and let account deletion
  miss the subscription, which would have kept charging a deleted account.
  Subscribers are now identified by the account that started the checkout,
  billing opens by the stored customer, and deletion looks a subscription up
  three ways and cancels only the ones that belong to the deleting user
- **Deleting an account now cancels a paused subscription.** A paused
  subscription grants no access but resumes and bills on its own, and deletion
  used to skip it. Pause and resume are now applied as they happen, paused
  subscribers can reach "Manage billing", and a paused subscriber is pointed at
  resuming rather than starting a second subscription
- The account deletion warning now appears for every subscription that can
  still charge (including unpaid, incomplete and lapsed ones), not only for
  active Supporters

### Changed

- **Account deletion moved into a confirmation dialog.** The danger zone is
  now one short row; the dialog explains what is deleted in a single message,
  says plainly that deletion ends a subscription immediately without refunding
  time already paid for (except where the law requires it), and asks you to
  type "delete my account" before it will proceed
- **Dialogs are accessible.** Every dialog is announced as a dialog with its
  title, keeps keyboard focus inside while open, closes on Escape, and returns
  focus to whatever opened it. A confirmation opened from inside another
  dialog closes on its own, and the overlay now covers the whole page
- The Terms of Service say that deleting an account does not by itself refund
  time already paid for. The Terms now carry their own "last updated" date,
  separate from the Privacy Policy's
- Billing moved to Polar's versioned API (2026-10) and its 1.x SDK, ahead of
  Polar retiring the previous API version in January 2027
- Node.js 22 or later is required to build the project

### Development

- Continuous integration typechecks and builds every pull request, with no
  secrets available to the run
- Pull requests get a Claude code review: automatically for the owner's, and
  on request for anyone else's. The Claude workflows can only be invoked by the
  repository owner, run pinned action versions kept current by Dependabot, and
  read the pull request's diff without installing or running its code; an
  on-request review can also read the CI results
- Repository images were losslessly optimized, and the social card renderer
  rejects a `CHROME_PATH` that cannot be run instead of failing later

## [1.1.2] - 2026-07-29

### Added

- **Social preview images** for every page. The site asked for a large preview
  card and supplied no image, so a link posted to Discord, WhatsApp, Reddit or
  Teams rendered as a bare text stub. Each of the 12 diagram pages now has its
  own card showing that diagram, with separate cards for the homepage, the
  guides hub, pricing and comparison

### Changed

- **The 404 page is simpler.** The heading names the error, three short lines
  replace a paragraph followed by a list of reasons and six links, and the
  main button goes back to the homepage rather than further into the site
- The build now fails if a page references a social card that is not there, and
  if a view can be navigated to but has no route (the latter would 404 only
  after a reload)

## [1.1.1] - 2026-07-29

Both of the faults below affected the deployed site only. Nothing was wrong
locally, which is how 1.1.0 shipped with them: neither the dev server nor
`npm run build` exercises the code path involved.

### Fixed

- **Every page except the homepage returned 404.** Two independent faults. The
  deployment's build command was overridden outside version control, so the
  diagram pages, route shells and `sitemap.xml` were never generated; and the
  SPA fallback rewrote to `/index.html`, which cannot work alongside clean URLs.
  Between them they took out `/pricing`, `/compare`, `/privacy`, `/terms`,
  `/settings`, `/editor`, `/diagrams/*`, `/sitemap.xml` and every share link
- **The API functions could not start.** Relative imports in `api/` were missing
  the file extension Node's ESM loader requires, so hosted AI generation,
  checkout, the billing portal, usage reporting, account deletion and the Polar
  webhook all failed to load when invoked
- Share links with a malformed slug now return a real 404 instead of quietly
  rendering the landing page
- Moving around the app can no longer produce a URL that works until you reload

### Added

- A 404 page, served with a genuine 404 status rather than answering with the
  app and a 200, which would tell crawlers that every mistyped URL is a page
- A Diagrams link in the landing page navigation and footer. The prerendered
  diagram pages were reachable only from search results before
- A build-time route guard, so a route the deployment cannot serve fails the
  build instead of 404ing only in production

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

[1.1.3]: https://github.com/sukarth/IB-EconGraph-AI/releases/tag/v1.1.3
[1.1.2]: https://github.com/sukarth/IB-EconGraph-AI/releases/tag/v1.1.2
[1.1.1]: https://github.com/sukarth/IB-EconGraph-AI/releases/tag/v1.1.1
[1.1.0]: https://github.com/sukarth/IB-EconGraph-AI/releases/tag/v1.1.0
[1.0.0]: https://github.com/sukarth/IB-EconGraph-AI/releases/tag/v1.0.0
