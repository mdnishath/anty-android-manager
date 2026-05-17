# CloudPhone Manager — Frontend Build Prompt

**Document type:** Implementation prompt (hand this to an AI coding agent or use as the human spec)
**Target:** Build the entire Electron + React frontend for CloudPhone Manager from scratch
**Date:** 2026-05-17
**Status:** Approved — ready to execute
**Revision:** v2 — incorporates server-state architecture (TanStack Query), Electron security hardening, error boundary spec, theme FOUC prevention, code splitting, mandatory log virtualization, IPC runtime validation, and build/packaging plan.

---

## 0. How to use this document

This file is a **prompt**. Read it top-to-bottom and build exactly what it describes. It is the single source of truth for the frontend. If a screen, component, or behavior is not described here, do **not** invent it — ask first.

The frontend is one half of a two-process desktop app. The Python FastAPI backend (sidecar) is already designed and partially built; this prompt only covers the **Electron + React** half. The backend contract (REST + WebSocket) is summarized in §8; do not modify it from the frontend side.

Build incrementally in this order:

1. Scaffold + design system + layout shell (§3, §4, §5)
2. Phones list + Phone Detail + Create Wizard (§6.2, §6.3, §6.4)
3. Dashboard (§6.1)
4. Snapshots, APK Library, Network, Fingerprint, Logs (§6.5 – §6.9)
5. Automation skeleton, Settings, About (§6.10 – §6.12)
6. Polish: command palette, shortcuts, motion (§7)

---

## 1. Project context

**Product:** CloudPhone Manager — a local desktop app that lets one user create, configure, isolate, and operate many virtual Android phones (redroid Docker containers) on a single PC. Built for multi-accounting.

**Architecture (whole product, for context only):**

- **Frontend (this doc):** Electron main process + React renderer.
- **Backend sidecar:** Python FastAPI on `127.0.0.1`, spawned by Electron `main.ts`. Exposes REST + WebSocket. Owns Docker, ADB, SQLite, scrcpy.
- **Phone runtime:** redroid containers on Docker Desktop + WSL2. Each phone has independent identity, storage, network.
- **Display:** scrcpy opens in its own native OS window (the frontend launches it via backend, it is **not** embedded).

**What the frontend does NOT do:** talk to Docker, talk to ADB, manage files on disk, run scrcpy itself. It only renders state and triggers backend actions.

**Sidecar lifecycle states** (received via IPC): `starting | ready | exited | error`. The UI must reflect this — most actions are disabled until `ready`.

---

## 2. Tech stack & dependencies

### Core (locked)

| Package | Version | Why |
|---|---|---|
| `electron` | ^32 | Desktop shell |
| `electron-vite` | ^2 | Dev server + build for main + renderer + preload |
| `react` | ^18 | UI |
| `react-dom` | ^18 | |
| `react-router-dom` | ^6 | Routing (use `createMemoryRouter` — see §5) |
| `typescript` | ^5.6 | Strict mode on |
| `vite` | ^5 | Bundler |
| `zustand` | ^4 | **UI state only** (sidebar, theme, command palette open) — never server data |
| `@tanstack/react-query` | ^5 | **Server state** — all REST data, caching, optimistic updates, refetch on WS reconnect |
| `@tanstack/react-virtual` | ^3 | Mandatory for logs (high-frequency append) and any list > 100 items |

### UI layer (add)

| Package | Why |
|---|---|
| `tailwindcss` ^3.4 + `postcss` + `autoprefixer` | Utility CSS |
| `@radix-ui/react-*` (dialog, dropdown-menu, tabs, tooltip, popover, switch, select, scroll-area, separator, accordion, collapsible) | Accessible primitives. **Do not** install `@radix-ui/react-toast` — use `sonner`. |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Variants + class composition |
| `lucide-react` | Icons |
| `framer-motion` | Sidebar collapse, page transitions |
| `cmdk` | Command palette (⌘K) |
| `sonner` | Toast notifications |
| `react-hook-form` + `zod` + `@hookform/resolvers` | Forms + validation. Zod also used at IPC + WS boundaries (§8.4, §8.3). |
| `react-error-boundary` | Per-route and global error boundaries (§7.11) |
| `date-fns` | Time formatting |
| `@visx/shape` + `@visx/scale` + `@visx/axis` | Dashboard line charts. **Do not** use recharts (~150 KB gzip for two charts is wasteful). visx is tree-shakeable, ~30 KB for what we need. |

### Dev tooling (add)

| Package | Why |
|---|---|
| `vitest` ^2 + `@testing-library/react` + `jsdom` | Already present, keep |
| `@types/node` | |
| `eslint` + `@typescript-eslint` + `eslint-plugin-react` + `eslint-plugin-react-hooks` | Linting (configure but don't go overboard) |
| `prettier` | Format |
| `electron-builder` | Packaging (nsis on Windows, dmg on mac, AppImage on Linux) — see §17 |
| `electron-updater` | Auto-update via GitHub Releases — see §17 |
| `@tanstack/react-query-devtools` | Dev-only query inspector |

**Do not add:** Redux, MUI, Chakra, Mantine, Ant Design, styled-components, emotion, jQuery, moment.js, lodash (use native + `date-fns`), recharts, `@radix-ui/react-toast`.

---

## 3. Design system

Design tone: **modern, calm, dense-but-readable, slightly playful**. Think Linear / Vercel dashboard / Raycast. Not enterprise-grey, not consumer-bright.

### 3.1 Color tokens (CSS vars driven by Tailwind theme)

Define HSL tokens in `src/styles/global.css` under `:root` (light) and `.dark` (dark). Wire into Tailwind via `tailwind.config.ts`.

**Dark (default):**
```
--bg            222 18% 7%      /* app background */
--bg-elev       222 16% 10%     /* cards, sidebar */
--bg-elev-2     222 14% 13%     /* hovered cards, modals */
--border        222 12% 18%
--border-strong 222 10% 26%
--fg            210 20% 96%     /* primary text */
--fg-muted      215 14% 70%     /* secondary text — bumped from 65% for AA on bg */
--fg-subtle     215 12% 55%     /* tertiary — bumped from 45% for AA on bg */
--accent        217 91% 60%     /* brand blue */
--accent-fg     0 0% 100%
--success       142 70% 45%
--success-bg    142 70% 12%     /* banner / pill background */
--warning       38 92% 55%
--warning-bg    38 92% 14%
--danger        0 72% 58%
--danger-bg     0 72% 14%
--info          199 89% 55%
--info-bg       199 89% 14%
--ring          217 91% 60%
```

**Light:**
```
--bg            0 0% 100%
--bg-elev       220 14% 98%
--bg-elev-2     220 14% 95%
--border        220 13% 88%
--border-strong 220 13% 78%
--fg            222 47% 11%
--fg-muted      215 16% 35%
--fg-subtle     215 14% 42%     /* bumped from 50% to clear AA 4.5:1 on white */
--accent        217 91% 50%     /* darkened from 55% for AA on white */
--accent-fg     0 0% 100%
--success       142 65% 30%     /* darkened for AA on white */
--success-bg    142 65% 94%
--warning       30 90% 38%      /* darkened for AA on white */
--warning-bg    30 90% 94%
--danger        0 70% 45%       /* darkened for AA on white */
--danger-bg     0 70% 96%
--info          199 89% 40%     /* darkened for AA on white */
--info-bg       199 89% 94%
--ring          217 91% 50%
```

**Contrast policy:** All text-on-bg combinations must clear WCAG AA (4.5:1 for body, 3:1 for large/UI). Verify status pill text against its bg variant (e.g. `text-success` on `bg-success-bg`) — must clear 4.5:1. Run `pa11y` or axe-core in CI for theme-rendered pages (§11).

**Phone status colors** (reuse semantic tokens):
- `CREATING`, `BOOTING`, `STOPPING`, `DELETING` → warning (amber, with pulse)
- `RUNNING` → success (green)
- `CREATED`, `STOPPED` → muted
- `ERROR` → danger

### 3.2 Typography

- Font: Inter (self-host via `@fontsource-variable/inter`) for UI; `JetBrains Mono` for logs/code/IDs.
- Scale: `text-xs 12`, `text-sm 13`, `text-base 14`, `text-lg 16`, `text-xl 18`, `text-2xl 22`, `text-3xl 28`. Body default = 14.
- Weight: 400 body, 500 emphasized, 600 headings. Avoid 700.

### 3.3 Spacing, radius, shadow, motion

- Spacing scale = default Tailwind (4px base).
- Radius: `rounded-md` (6) for inputs/buttons, `rounded-lg` (8) for cards, `rounded-xl` (12) for modals/sheets, `rounded-full` for status pills and avatars.
- Shadow: keep flat. Only `shadow-sm` for popovers, `shadow-lg` for modals. No drop shadows on cards (use border + bg-elev instead).
- Motion: 150ms for hover/press, 200ms for collapse/expand, 250ms ease-out for page transitions. Respect `prefers-reduced-motion`.

### 3.4 Iconography

`lucide-react` only. Default size 16 (`h-4 w-4`) inline, 18 in sidebar, 20 in page headers. Stroke width 2.

---

## 4. Layout shell

```
┌────────────────────────────────────────────────────────────────┐
│ TitleBar (Electron frameless, draggable, custom traffic lights)│
├──────────┬─────────────────────────────────────────────────────┤
│          │ TopBar  [breadcrumb]    [search]   [⌘K] [theme] [⋮]│
│ Sidebar  ├─────────────────────────────────────────────────────┤
│          │                                                     │
│          │              Content area (routed)                  │
│          │                                                     │
│          │                                                     │
│          ├─────────────────────────────────────────────────────┤
│ Footer   │ StatusBar  ● backend: ready · 4/12 phones · 18 GB  │
└──────────┴─────────────────────────────────────────────────────┘
```

### 4.1 TitleBar

- Electron `BrowserWindow` with `titleBarStyle: 'hiddenInset'` (mac) / custom on Windows/Linux.
- Draggable region: full top bar (`-webkit-app-region: drag`), buttons/inputs explicitly `no-drag`.
- Show app name + current route title centered (on mac) or left (Windows).
- Custom min/max/close on Windows/Linux. On mac use native traffic lights.

### 4.2 Sidebar (the centerpiece — modern, collapsible)

**Two states, animated transition (framer-motion, 200ms ease-out):**

- **Expanded:** width 240px. Shows icon + label + (optional) badge for each nav item.
- **Collapsed:** width 64px. Icon-only. Label appears as tooltip on hover (Radix `Tooltip`, side="right", delay 200ms).

**Toggle behavior:**

- A `PanelLeft` / `PanelLeftClose` icon button at the top-right of the sidebar.
- Keyboard shortcut: `Cmd/Ctrl + B`.
- State persisted to `localStorage` under `cp.sidebar.collapsed`.
- On window width < 900px, auto-collapse (but user can still expand manually).

**Sections:**

```
┌─────────────────────────┐
│ [Logo] CloudPhone   [<] │   ← brand + collapse toggle
├─────────────────────────┤
│ MAIN                    │   ← section label (hidden when collapsed)
│ ▸ Dashboard             │
│ ▸ Phones        [12]    │   ← badge = total count
│ ▸ Snapshots             │
│ ▸ APK Library           │
├─────────────────────────┤
│ CONFIGURE               │
│ ▸ Network / Proxy       │
│ ▸ Fingerprints          │
│ ▸ Automation            │
├─────────────────────────┤
│ SYSTEM                  │
│ ▸ Logs                  │
│ ▸ Settings              │
├─────────────────────────┤  ← mt-auto (push to bottom)
│ ● backend: ready        │   ← sidecar state pill
│ [Avatar] Local user  ⋮  │   ← user/menu (future-proof)
└─────────────────────────┘
```

**Section labels:** small uppercase, `text-xs text-fg-subtle tracking-wide`, hidden in collapsed state.

**Nav item:**

- Component: `<SidebarNavItem icon={Icon} label="..." to="/path" badge?={n} />`
- Active: `bg-bg-elev-2 text-fg`, left accent bar `bg-accent w-0.5`.
- Hover: `bg-bg-elev-2/60`.
- Smooth label fade-out (opacity + width) when collapsing.

**Sidebar shell uses Radix `Collapsible` for animated width** plus an explicit `motion.div` for label opacity. Do not use CSS `transition: width` alone — it stutters on text reflow. Animate `width` via framer-motion's `animate` prop, animate label `opacity` separately.

### 4.3 TopBar

Height 48px. Sticky.

- **Left:** breadcrumb (e.g. `Phones / pixel-7-aurora`). Last segment is current page title.
- **Center:** global search input (placeholder "Search phones, snapshots, APKs..."). Triggers command palette on focus.
- **Right (in order):**
  - `⌘K` chip (opens command palette, also bound to `Cmd/Ctrl+K`).
  - Theme toggle (`Sun` / `Moon` / `Monitor` cycling — light / dark / system).
  - Overflow `⋮` menu (Help, About, Restart backend, Open logs folder, Quit).

### 4.4 StatusBar (footer)

Height 28px. Sticky to app bottom.

- Left: sidecar state pill (green/amber/red dot + label).
- Center: `4 running / 12 total phones · 14.2 / 32 GB RAM · 8 CPU` (capacity summary, live).
- Right: WebSocket connection indicator (dot only) + last event timestamp.

**Overflow strategy:** at window widths below 1100px, drop segments in this priority order (lowest priority first dropped): last event timestamp → RAM detail → CPU → phone count detail. Full data always available via tooltip on the truncated segment. Below 700px, status bar collapses to icons-only with a popover for details.

### 4.5 Content area

- Max-width: none (fill). Padding `p-6` (24px).
- Page transitions: framer-motion `AnimatePresence` with subtle 8px y-translate + opacity, 200ms.
- Each route renders its own page-header (title + subtitle + page-level actions on the right).

---

## 5. Routing

Use `react-router-dom` v6 with `createMemoryRouter`. Electron has no URL bar — hash routes are visual noise in devtools, memory router keeps state clean and avoids `file://` quirks at production. No external deep-linking needs URLs.

```
/                          → redirect /dashboard
/dashboard
/phones                    → grid view (default)
/phones?view=table         → table view
/phones/new                → create wizard
/phones/:id                → detail (default tab: overview)
/phones/:id/snapshots
/phones/:id/apps
/phones/:id/network
/phones/:id/fingerprint
/phones/:id/logs
/snapshots                 → global snapshots library
/apk-library
/network
/fingerprints              → fingerprint presets manager
/automation                → skeleton (Phase 6)
/logs                      → global system logs
/settings
/about
*                          → NotFound
```

Use nested routes for phone detail tabs so the layout/header persists when switching tabs.

**Code splitting:** every route component is `React.lazy()`-loaded with a `<Suspense fallback={<PageSkeleton />}>` boundary. The shell (sidebar, topbar, statusbar) is in the main bundle; pages are individual chunks. Dashboard (visx), CreatePhone (rhf+zod heavy), Settings, and APK Library are the largest chunks — verify each is < 80 KB gzipped post-build. Each route is also wrapped in a `<RouteErrorBoundary>` (§7.11).

---

## 6. Pages (full ambition — all phases)

For every page below:

- Top: page header (title, subtitle, primary action button on the right).
- Loading: skeleton placeholders, never spinners on full page.
- Empty state: illustration (use lucide `Inbox` / `Smartphone` icons in a circle), helpful copy, primary CTA.
- Error state: red banner with retry button. Never crash the page.

### 6.1 Dashboard (`/dashboard`)

**Goal:** At-a-glance system health.

**Header:** "Dashboard" — no primary action.

**Layout:** 12-col grid, gap-6.

Cards (use the shared `<StatCard>` component):

1. **Total phones** (`col-span-3`) — big number, sublabel "X running · Y stopped".
2. **Host capacity** (`col-span-3`) — RAM used/total bar + CPU bar. Each bar `<CapacityBar value={used} max={total} variant="ram|cpu" />`.
3. **Sidecar status** (`col-span-3`) — green dot + uptime + restart button.
4. **Docker** (`col-span-3`) — running / image count.

Charts (`col-span-6` each):

5. **CPU history** — Recharts `<LineChart>`, last 5 min, polled every 5s.
6. **RAM history** — same.

Lists (`col-span-6` each):

7. **Recent activity** — last 10 events from WS feed (created, started, stopped, errored). Each row: icon, phone name, action, relative time.
8. **Alerts** — health banner items (capacity > 85%, sidecar down, backend behind, etc.) with severity color and CTA.

### 6.2 Phones (`/phones`)

**Goal:** Manage the fleet.

**Header:** "Phones" + count badge. Right: view-toggle (Grid / Table), filter button, "New Phone" primary CTA.

**Filters** (collapsible row): status, Android version, fingerprint preset, proxy group, tag, text search. Show as chip row when active.

**Bulk actions bar:** appears when ≥1 phone selected. Sticky just below header. Buttons: Start, Stop, Snapshot, Delete, Clone, Tag. Confirmation dialog for destructive actions.

#### 6.2.1 Grid view (default)

- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`, gap-4.
- `<PhoneCard>` shows: name, status pill, Android version + DPI, fingerprint label, proxy badge, RAM/CPU mini-bars (live), thumbnail (last scrcpy frame if available, else gradient placeholder), action row: Start/Stop, Open (scrcpy), ⋮ menu (Snapshot, Clone, Edit, Tag, Delete).
- Card hover: lift to `bg-bg-elev-2`, show selection checkbox in top-left corner.
- Boot progress: when status is `CREATING` or `BOOTING`, replace action row with `<BootProgress>` (current step text + indeterminate bar).

#### 6.2.2 Table view

- Columns: select | name | status | Android | resolution | fingerprint | proxy | uptime | RAM | CPU | actions.
- Sortable headers. Row click → detail. Right-click → context menu.
- Compact density (h-9 rows).

### 6.3 Phone Detail (`/phones/:id`)

**Header:** phone name (editable inline — see UX spec below), status pill, last error (if any), action cluster: Start/Stop, Open in scrcpy, ⋮ (Snapshot, Clone, Restart, Force-stop, Delete).

**Inline-edit UX (reusable `<EditableText>` primitive):**
- Display: text + subtle pencil icon on hover (icon hidden until hover; appears at `text-fg-subtle`).
- Activate: single click on text OR click pencil icon.
- Edit state: text becomes an `<input>` with same font/size, auto-selected, no chrome change (just `ring-1 ring-ring`).
- Submit: Enter key OR blur (both commit). Esc reverts.
- Validation: slug rules (lowercase, alphanumeric + `-`, 2-40 chars). Invalid → ring turns danger, tooltip shows reason, blur does NOT commit invalid value (returns to edit state).
- After commit: optimistic update + PATCH request. On error: revert + error toast.

**Tab strip** (Radix Tabs, sticky under header):

`Overview · Snapshots · Apps · Network · Fingerprint · Logs`

#### 6.3.1 Overview tab

Two-column (`grid-cols-3`, left `col-span-2`, right `col-span-1`):

- **Left:** `<AboutPhone>` — labeled key/value list (ID, container ID, image, Android version, created, last started, uptime, RAM limit, CPU shares, resolution/DPI, GPU mode, locale, timezone, GPS, tags).
- **Right:**
  - Live stats card (RAM, CPU, network) — small sparklines.
  - Quick actions card (same buttons as header for accessibility).
  - Tags editor card.

#### 6.3.2 Snapshots tab

- Table of snapshots: name, created, size, parent, actions (Restore, Clone-from, Export, Delete).
- "Create snapshot" CTA opens a dialog: name + description + "stop phone first?" toggle.
- Restore is a confirmed action with red destructive style.

#### 6.3.3 Apps tab

- Two sub-views: **Installed** (list from ADB) and **Install from APK Library**.
- Installed: search, list with package name + label + version. Row actions: Open, Stop, Clear data, Uninstall.
- Install: open APK Library drawer, multi-select, install with progress per APK.

#### 6.3.4 Network tab

- Proxy config: type (none/HTTP/HTTPS/SOCKS5), host, port, user, pass. Live test button.
- Per-app proxy routing (skeleton checkbox, disabled with "Phase 6" badge).
- DNS override.
- Show outbound IP (queried via phone) with refresh button.

#### 6.3.5 Fingerprint tab

- Form to edit fingerprint props: model, brand, manufacturer, device, product, build ID, build incremental, security patch, Build.DISPLAY, gsm.operator.alpha, gsm.operator.numeric, country, sim_number, MEID/IMEI (read-only, marked "Unknown — limitation").
- "Regenerate" button: randomizes from a real-device pool.
- "Apply preset" dropdown: list of saved fingerprints from Fingerprint Presets.
- Save requires phone restart — show inline warning + confirmation.

#### 6.3.6 Logs tab

- Live tail of phone logs (logcat + container stderr) over WebSocket.
- Filter: level (V/D/I/W/E), tag, free text.
- Pause / resume / clear / download buttons.
- Mono font. **Virtualized list (`@tanstack/react-virtual`) is mandatory from day one** — Android logcat regularly emits 50–200 lines/sec; 10 minutes = 100k+ DOM nodes if not virtualized, which crashes the renderer. Do not defer this.
- Append behavior: maintain a ring buffer (default 10k lines, configurable in Settings → Advanced). Auto-scroll to bottom unless user has scrolled up — then show a floating "Jump to latest" pill.
- WS bursts: batch incoming lines via `requestAnimationFrame` (collect lines in a ref, flush once per frame) so 200 events/sec don't trigger 200 re-renders.

### 6.4 Create Phone Wizard (`/phones/new`)

Multi-step modal-style page (full-bleed in content area, not actually a modal). 5 steps with a left progress indicator (vertical stepper).

```
┌──────────────────┬───────────────────────────────────────────┐
│ Step 1 ●         │                                           │
│ Step 2 ○         │           [Step content here]             │
│ Step 3 ○         │                                           │
│ Step 4 ○         │                                           │
│ Step 5 ○         │                                           │
└──────────────────┴───────────────────────────────────────────┘
                                              [Back]  [Next →]
```

1. **Basics** — name (slug auto-derived), tags, color tag, notes.
2. **Image** — Android version (13/14/15/16) + variant (GAPPS / microG / vanilla) cards.
3. **Hardware** — RAM (slider 1–8 GB), CPU shares (1–8), resolution (preset dropdown + custom), DPI, GPU mode.
4. **Identity** — fingerprint preset OR custom (collapsible advanced), locale, timezone, GPS coords:
   - **Paste-from-Google-Maps:** single text input accepts a Google Maps URL (e.g. `https://www.google.com/maps/@40.7128,-74.0060,15z` or `https://maps.google.com/?q=40.7128,-74.0060`). Parser extracts lat/lng with zod validation, shows ✓ + parsed coords below.
   - **City presets:** dropdown of ~30 common cities (New York · Tokyo · London · Dhaka · Singapore · São Paulo · …). Selecting fills lat/lng and sets timezone + locale defaults (which user can override).
   - **Manual lat/lng:** two number inputs, range-validated (-90/90, -180/180), shown by default.
   - All three modes write to the same `{lat, lng}` field; only one is "active" at a time (tab switcher).
   - **Future** (deferred to Phase 6+): embedded map widget (Leaflet + OSM tiles, no API key needed). Do not build now.
5. **Network** — proxy (none / preset / custom), DNS, network mode (bridge — locked, "host" disabled with reason).

Final step: **Review** (summary card) + "Create phone" button. After submit → progress page (live `<BootProgress>` from WS) → redirect to phone detail when `RUNNING`.

Form: `react-hook-form` + `zod` schema per step, single root schema for final submit. Persist draft to `sessionStorage` so refresh doesn't lose work. Step nav only allows forward if current step is valid.

### 6.5 Snapshots library (`/snapshots`)

Global view of all snapshots across phones. Same table as the per-phone snapshots tab plus a `phone` column. Filters: phone, age, size.

### 6.6 APK Library (`/apk-library`)

- Grid of APK cards: icon, label, package, version, size, install count.
- Upload: drag-and-drop zone + file picker. Parse manifest server-side, show progress.
- Bulk install dialog: pick target phones, install with per-phone progress.
- Delete with confirmation.

### 6.7 Network / Proxy (`/network`)

- Proxy groups: named collections of proxies. CRUD UI.
- Each group: list of proxy endpoints (type, host, port, auth, geo, last-test result).
- "Test all" button — runs health check, marks each row green/red.
- Assign group to phone(s) via bulk action.

### 6.8 Fingerprint presets (`/fingerprints`)

- List of saved fingerprint presets. CRUD.
- Each preset shows: name, model, Android version, region. Preview drawer shows all props.
- "Import from real device" placeholder (disabled, "future").

### 6.9 Logs (`/logs`)

- Tabs: Backend (sidecar stdout/stderr) · Electron main · Docker · System events.
- Same controls as phone logs tab (filter, pause, clear, download).
- Default view = Backend.

### 6.10 Automation (`/automation`)

- **Skeleton only** (Phase 6). Render a "Coming soon" empty state with feature preview cards (Tasks, Scheduler, Scripts, UI Automator). Each card disabled, with a "Preview" badge.
- Do not build forms or runtime — just the surface so the nav slot exists.

### 6.11 Settings (`/settings`)

Tabs (Radix `Tabs` vertical):

- **General:** language (en only for now), startup behavior (auto-start backend), confirmation prompts toggle.
- **Appearance:** theme (light/dark/system), sidebar default state, density (cozy/compact).
- **Backend:** sidecar port, restart sidecar button, view logs link.
- **Docker:** image pull settings, default image, registry mirror.
- **Storage:** data dir (read-only, "Open in Explorer"), snapshot dir, APK dir. Show usage per folder.
- **Shortcuts:** list all keyboard shortcuts (read-only for v1).
- **Advanced:** dev tools toggle, telemetry (off, no-op), reset settings.

All settings persisted via Electron `electron-store` (in main process, accessed via IPC). Renderer never touches disk directly.

### 6.12 About (`/about`)

- App icon + name + version + commit hash.
- Sidecar version, Electron version, Chromium version, Node version.
- Links: docs, GitHub, license.
- "Check for updates" button (no-op placeholder).

---

## 7. Cross-cutting components & patterns

### 7.1 Component inventory

Build these once in `src/components/ui/` (shadcn-style):

`Button` (variants: default, secondary, ghost, outline, destructive, link; sizes: sm, md, lg, icon), `IconButton`, `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `Slider`, `Label`, `Badge` (variants: default, success, warning, danger, info, muted), `Card` (with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`), `Dialog`, `Sheet` (right-side drawer), `DropdownMenu`, `Tooltip`, `Popover`, `Tabs`, `Accordion`, `Separator`, `Avatar`, `ScrollArea`, `Toast` (via `sonner`), `Skeleton`, `EmptyState`, `Kbd` (keyboard chip), `CommandPalette` (cmdk).

Domain components in `src/components/`:

`SidebarNavItem`, `StatusBadge`, `CapacityBar`, `StatCard`, `PhoneCard`, `PhoneRow`, `BootProgress`, `AboutPhone`, `HealthBanner`, `LogViewer`, `FingerprintForm`, `ProxyForm`, `SnapshotTable`, `ApkCard`, `StepIndicator`, `ThemeToggle`, `BackendStateDot`, `ConfirmDialog`, `BulkActionBar`.

### 7.2 Command palette (⌘K)

`cmdk`-based, opened from TopBar chip or `Cmd/Ctrl+K`.

Groups:

- **Navigate:** every nav route.
- **Phones:** "Start <phone>", "Stop <phone>", "Open <phone>" for each phone.
- **Actions:** "Create phone", "New snapshot", "Upload APK", "Restart backend".
- **Theme:** Switch to light / dark / system.

Fuzzy search, keyboard navigation, recent commands at top.

### 7.3 Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + N` | New phone |
| `Cmd/Ctrl + ,` | Settings |
| `Cmd/Ctrl + /` | Show shortcuts cheatsheet |
| `g d` | Go to Dashboard |
| `g p` | Go to Phones |
| `g s` | Go to Snapshots |
| `g l` | Go to Logs |
| `Esc` | Close modal / clear selection |

Use a small `useShortcut(combo, handler)` hook. Don't pull in `react-hotkeys-hook` unless friction shows up.

### 7.4 Toasts

`sonner` `<Toaster position="bottom-right" richColors closeButton />`. Variants: default, success, error, warning, loading (with promise helper). Auto-dismiss 4s, sticky for errors.

### 7.5 Confirmation dialogs

Single `<ConfirmDialog>` component. Destructive variant uses danger button. All Delete / Restore / Reset actions go through it. Never use `window.confirm`.

### 7.6 Optimistic updates & state precedence

Mutations (start, stop, delete, tag, rename) use TanStack Query's `useMutation` with `onMutate` to apply optimistic cache updates immediately, then reconcile.

**Precedence rules (strict):**

1. **WebSocket events always win** over REST mutation responses. If a `phone.status_changed` event arrives saying RUNNING after we sent a `POST /stop`, the WS state stands — we trust the live event over the (possibly stale) HTTP response.
2. **REST mutation responses do not downgrade** WS-confirmed state. Example: user clicks Start → optimistic `BOOTING` → WS `RUNNING` arrives → REST response (delayed) returns `BOOTING` → ignore (we already have a newer confirmed state).
3. **Tag each cache write with a monotonic timestamp** (client clock fine — this is single-user). Compare timestamps; never overwrite newer with older.
4. **On mutation error:** rollback the optimistic update (`onError` restores the snapshot taken in `onMutate`), show error toast. If a WS event for the same entity arrived between optimistic and error, keep the WS state (don't rollback over it).
5. **On WS reconnect:** all server-state queries are invalidated and refetched (§8.3). Optimistic state during disconnect is preserved only until the refetch completes.

### 7.7 Motion

- Sidebar collapse: framer-motion `animate={{ width: collapsed ? 64 : 240 }}`, 200ms ease-out.
- Page transitions: `AnimatePresence mode="wait"` with `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}`.
- Toast slide-in handled by `sonner`.
- Status pill on running phones: subtle `animate-pulse` for boot states only.

Respect `prefers-reduced-motion`: framer-motion's `useReducedMotion` hook → set duration to 0.

### 7.8 Empty states

Template: icon-in-circle (`bg-bg-elev p-4 rounded-full`), heading, one-line description, primary CTA. Never just blank.

### 7.9 Accessibility

- All interactive elements reachable by Tab.
- Visible focus ring (Tailwind `focus-visible:ring-2 ring-ring`).
- Sidebar collapse toggle has `aria-label` + `aria-expanded`.
- Tooltips on icon-only buttons (collapsed sidebar).
- Color is never the only signal (status pill has text label too).
- Modals trap focus (Radix handles this) and restore on close.
- Skip-to-content link (visually hidden, appears on focus).

### 7.10 i18n hook (no actual translation yet)

Wrap all UI strings in a `t('key')` no-op that returns the key. This keeps the door open without committing to a library. Centralize strings in `src/i18n/en.ts`.

### 7.11 Error boundaries

Use `react-error-boundary`. Two layers, both mandatory:

- **Global `<AppErrorBoundary>`** at the root, inside `<ThemeProvider>` but outside `<RouterProvider>`. Catches anything the route boundary missed (provider/store errors). Fallback: full-screen card with app icon, "Something went wrong", error message (truncated), Reload App button (calls `window.cp.restartApp?.()` or `location.reload()`), and "Copy diagnostics" button (copies stack + app version + sidecar state to clipboard).
- **Per-route `<RouteErrorBoundary>`** wraps each lazy route element. Fallback: in-content red card with "This page crashed", error message, Retry button (re-mounts route via `resetErrorBoundary`), Go to Dashboard link. **Resets automatically on route change** via `resetKeys={[location.pathname]}`.

**Logging:** boundary `onError` callback forwards `{message, stack, componentStack, route, appVersion, sidecarState}` to main via IPC (`window.cp.reportError(payload)`), which writes to `electron-log`. Never silently swallow.

**What NOT to wrap in a boundary:** event handlers (they don't bubble to error boundaries — use try/catch + toast). Async errors inside `useEffect` (same — handle locally). TanStack Query errors (use `useQuery({ throwOnError: true })` to forward to boundary, or handle inline with `error` state).

### 7.12 Code splitting & Suspense

- Every route component is `React.lazy(() => import('./pages/...'))`.
- Each route is wrapped in `<Suspense fallback={<PageSkeleton />}>` inside its `<RouteErrorBoundary>`.
- `<PageSkeleton>` is a generic loading shape (header + 3 stat cards + table skeleton) — close enough for any route while it loads.
- **Preload on hover:** `<SidebarNavItem>` and `<Link>` components call the lazy import on `onMouseEnter` / `onFocus` so the chunk is warm before the click. Use a tiny `preload(routeId)` registry in `src/router/preload.ts`.
- **Heavy dependencies live in their owning route chunk only:** visx in Dashboard, cmdk in CommandPalette (lazy-mounted on first ⌘K press, not at app start), `react-hook-form` + zod resolvers in CreatePhone.
- **Bundle budgets** (gzip, enforced in CI via `size-limit`):
  - Main bundle (shell + router + providers): **≤ 180 KB**
  - Dashboard chunk: ≤ 80 KB
  - CreatePhone chunk: ≤ 70 KB
  - Each other page chunk: ≤ 50 KB

---

## 8. State, data, and IPC

### 8.1 State architecture — strict split

There are **two** state systems with non-overlapping responsibilities. Mixing them is the most common mistake; don't.

#### 8.1.a Server state → TanStack Query (`src/api/queries/`)

All data that originates from the backend lives in TanStack Query's cache. **Never copy server data into Zustand.**

- `useQueryClient` configured in `src/api/query-client.ts`:
  - `staleTime: 30_000` default; `0` for live-stat queries; `Infinity` for static lookups (locales, presets).
  - `gcTime: 5 * 60_000`.
  - `refetchOnWindowFocus: false` (desktop app; WS is the truth).
  - `retry: (failureCount, err) => err.code !== 'NOT_FOUND' && failureCount < 2`.
  - Global `<ReactQueryDevtools />` in dev only.
- **Query key convention:**
  - `['phones']`, `['phones', id]`, `['phones', id, 'snapshots']`
  - `['snapshots']`, `['apks']`, `['proxy-groups']`, `['fingerprints']`
  - `['health']`, `['capacity']`
  - `['logs', source]` — uses `useInfiniteQuery` for pagination + WS append.
- **Hook files** in `src/api/queries/`: `usePhones.ts`, `usePhone.ts`, `useSnapshots.ts`, `useApks.ts`, etc. Each exports `useXxxQuery`, `useXxxMutation` pairs.
- **Mutations** use optimistic updates per §7.6. Standard skeleton:
  ```ts
  const m = useMutation({
    mutationFn: ({ id }) => api.startPhone(id),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['phones'] });
      const prev = qc.getQueryData(['phones']);
      qc.setQueryData(['phones'], applyStatus(prev, id, 'BOOTING'));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['phones'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['phones'] }),
  });
  ```
- **WS → cache bridge:** the WS event handler calls `qc.setQueryData(...)` for known events (per §8.3) and `qc.invalidateQueries(...)` for the rest. The handler lives in `src/api/ws-bridge.ts` and is mounted once at the app root.

#### 8.1.b UI state → Zustand (`src/store/`)

Only client-local, ephemeral, or user-preference state. Never server data.

- `ui.ts` — sidebar collapsed, command palette open, current theme override, density, current bulk selection IDs, log viewer filter state. Persisted to `localStorage` via `persist` middleware (whitelisted keys only).
- `settings.ts` — hydrated from main process at boot (see §8.5). Read-mostly; writes call IPC then update store.
- `transient.ts` — wizard draft (also session-storage backed), unsaved form drafts, last-seen-route per tab.

**Don't create** `phones.ts`, `snapshots.ts`, `apks.ts` etc. as Zustand stores — those are TanStack Query cache entries.

**Devtools:** wrap each store with Zustand's `devtools` middleware so Redux DevTools shows actions in dev.

### 8.2 REST client (`src/api/client.ts`)

Thin `fetch` wrapper:

- Base URL from `window.cp.sidecarUrl()` (IPC, returns `http://127.0.0.1:<port>`).
- JSON in/out, throws typed errors with `code`, `message`, `details`.
- Endpoints (mirror backend, do not invent):
  - `GET /phones`, `POST /phones`, `GET /phones/:id`, `PATCH /phones/:id`, `DELETE /phones/:id`
  - `POST /phones/:id/start`, `POST /phones/:id/stop`, `POST /phones/:id/restart`
  - `POST /phones/:id/scrcpy` (launches native window via backend)
  - `GET/POST/DELETE /phones/:id/snapshots`, `POST /phones/:id/snapshots/:sid/restore`, `/clone`
  - `GET/POST/DELETE /snapshots` (global)
  - `GET/POST/DELETE /apks`, `POST /apks/:id/install` (body: `{ phone_ids }`)
  - `GET/POST/DELETE /proxy-groups`, `/fingerprints`
  - `GET /health`, `GET /capacity`, `GET /logs/:source`

Group calls per-resource into `src/api/phones.ts`, `src/api/snapshots.ts`, etc. Never call `fetch` directly from a component.

### 8.3 WebSocket (`src/api/websocket.ts`)

- URL: `ws://127.0.0.1:<port>/ws`
- **Event payloads validated with zod** at receive time. Define schemas in `src/api/ws-schemas.ts`. Invalid payloads are logged + dropped — never trust the wire blindly even on localhost.
- Events:
  - `phone.created { id }`
  - `phone.deleted { id }`
  - `phone.status_changed { id, status, last_error?, ts }`
  - `phone.boot_progress { id, step, percent?, ts }`
  - `phone.stats { id, cpu, ram_mb, rx, tx, ts }`
  - `host.capacity { cpu, ram_used_mb, ram_total_mb, ts }`
  - `health.alert { severity, code, message, ts }`
  - `log.line { source, level, text, ts }` (only when a viewer is subscribed)
  - `seq { n }` — monotonic sequence number sent every event; client tracks last-seen to detect gaps.

**Connection manager** (`src/api/ws-bridge.ts`) — singleton, mounted once at app root:

- StrictMode-safe: connection instance held in module scope (not component state), so React 18 double-mount in dev doesn't open two sockets.
- Auto-reconnect with exponential backoff (1s → 2 → 4 → 8 → 16 → 30s cap, jittered ±20%).
- **Heartbeat:** client sends `{type:'ping'}` every 15s; server replies `pong`. No reply in 5s → force-close and reconnect.

**Reconnect reconciliation (mandatory):**

1. On socket open after a disconnect: `queryClient.invalidateQueries()` (all keys) → forces refetch of every active query. Server is the truth; in-flight optimistic state is preserved until refetch resolves and then overwritten.
2. Track `lastEventAt`. If `Date.now() - lastEventAt > 30_000` while socket is "connected", show a **"Data may be stale"** badge in StatusBar with a Refresh button (calls `invalidateQueries()`).
3. **Sequence gap detection:** if event arrives with `seq > lastSeq + 1`, invalidate all queries (we missed events).
4. On socket close (clean or not): mark `health` store state `disconnected`, surface the indicator in StatusBar.

Expose `subscribe(eventType, handler)` returning unsubscribe — components rarely need this (most consumers read via TanStack Query). Used for log viewers and live stats sparklines.

### 8.4 IPC bridge (`electron/preload.ts` + `src/ipc/`)

`preload.ts` exposes `window.cp` (contextBridge, contextIsolation: true):

```ts
window.cp = {
  sidecarUrl(): Promise<string>,
  onSidecarState(cb: (s: 'starting'|'ready'|'exited'|'error') => void): () => void,
  restartSidecar(): Promise<void>,
  restartApp(): Promise<void>,
  openExternal(url: string): Promise<void>,
  openPath(path: string): Promise<void>,
  showOpenDialog(opts): Promise<string[]>,
  getAllSettings(): Promise<SettingsSnapshot>,        // see §8.5
  setSetting(key: string, value: unknown): Promise<void>,
  onSettingsChanged(cb: (snap: SettingsSnapshot) => void): () => void,
  reportError(payload: ErrorReport): Promise<void>,   // forwarded to electron-log
  app: { version: string; commit: string; platform: NodeJS.Platform, electron: string, chrome: string, node: string },
}
```

Never expose `ipcRenderer` directly. Never expose `require`. Never disable `contextIsolation`.

#### Runtime validation (mandatory)

Every IPC payload — both directions — is validated with zod schemas defined in `src/ipc/schemas.ts` (shared via TypeScript path alias with `electron/`).

- **Renderer → main:** main-side handlers in `electron/ipc-handlers.ts` parse the input with `schema.safeParse(arg)` first; on failure, throw a typed error back. Treat preload as untrusted (compromised renderer = compromised preload).
- **Main → renderer:** preload validates payloads from main before exposing them. On schema mismatch, throw to caller (queries will surface the error to the boundary).

#### BrowserWindow security (locked, never relax)

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    enableBlinkFeatures: '',
    preload: path.join(__dirname, 'preload.js'),
  },
  ...
})
```

#### Content-Security-Policy

`index.html` `<head>` must include (production build):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob:;
  connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*;
  object-src 'none';
  base-uri 'self';
  form-action 'none';
  frame-ancestors 'none';
">
```

Dev build is allowed to add `'unsafe-eval'` to `script-src` for Vite HMR — gate via build env. `'unsafe-inline'` for styles is required by Tailwind's runtime arbitrary-class injection and Radix; nothing else needs it. No remote origins are ever allowed in `connect-src` (we only talk to the local sidecar).

#### Other hardening

- `app.on('web-contents-created', (_, contents) => { contents.setWindowOpenHandler(() => ({ action: 'deny' })); })` — block any popup.
- `contents.on('will-navigate', e => e.preventDefault())` — renderer never navigates away.
- Strip Electron remote module references (already removed in Electron 32).
- `electron-builder` packages with `asar: true` + `asarUnpack` only for required native modules.

### 8.5 Settings bootstrap

Reads through IPC are not free (~1ms roundtrip each). A Settings page reading 20+ keys individually = 20+ awaits = visible lag. Bootstrap once instead.

**Flow:**

1. App boot: main process loads `electron-store` synchronously, snapshots everything into a `SettingsSnapshot` object.
2. `preload.ts` exposes the snapshot synchronously via `contextBridge` (NOT an async call) — available as `window.cp.app.initialSettings`.
3. Renderer's `<App>` reads `initialSettings` once at mount and hydrates `useSettingsStore` (Zustand).
4. **Writes:** components call `useSettingsStore.getState().set(key, value)` which both (a) updates the store immediately (optimistic) and (b) fires `window.cp.setSetting(key, value)` (best-effort persistence; on error, revert + toast).
5. **Cross-process consistency:** main pushes `onSettingsChanged(snap)` to renderer when settings change from outside (e.g. CLI flag, future second window). Handler re-hydrates the store.

Result: zero IPC reads during normal UI; writes are fire-and-forget with rollback on failure.

`SettingsSnapshot` is a typed object (zod schema in `src/ipc/schemas.ts`); fields include theme, sidebar default, density, sidecar port, default Docker image, data dir, dev tools toggle, log buffer size, telemetry (always false for now). Default values defined in main; renderer never invents defaults.

---

## 9. File / folder structure

```
frontend/
├── electron/
│   ├── main.ts              # already exists — keep, wire sidebar shortcut accelerator
│   ├── preload.ts           # already exists — extend per §8.4
│   ├── ipc-handlers.ts      # already exists
│   ├── sidecar.ts           # already exists
│   ├── wsl-keepalive.ts     # already exists
│   └── types.ts
├── index.html
├── src/
│   ├── main.tsx             # mounts <App />, wraps with <ThemeProvider> + <Toaster>
│   ├── App.tsx              # router + shell
│   ├── layout/
│   │   ├── Shell.tsx
│   │   ├── TitleBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SidebarNavItem.tsx
│   │   ├── TopBar.tsx
│   │   ├── StatusBar.tsx
│   │   └── PageHeader.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── phones/
│   │   │   ├── PhonesList.tsx
│   │   │   ├── PhoneCardView.tsx
│   │   │   ├── PhoneTableView.tsx
│   │   │   ├── CreatePhone/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── StepBasics.tsx
│   │   │   │   ├── StepImage.tsx
│   │   │   │   ├── StepHardware.tsx
│   │   │   │   ├── StepIdentity.tsx
│   │   │   │   ├── StepNetwork.tsx
│   │   │   │   └── StepReview.tsx
│   │   │   └── PhoneDetail/
│   │   │       ├── index.tsx
│   │   │       ├── Overview.tsx
│   │   │       ├── Snapshots.tsx
│   │   │       ├── Apps.tsx
│   │   │       ├── Network.tsx
│   │   │       ├── Fingerprint.tsx
│   │   │       └── Logs.tsx
│   │   ├── Snapshots.tsx
│   │   ├── ApkLibrary.tsx
│   │   ├── Network.tsx
│   │   ├── Fingerprints.tsx
│   │   ├── Automation.tsx
│   │   ├── Logs.tsx
│   │   ├── Settings/
│   │   │   ├── index.tsx
│   │   │   └── tabs/...
│   │   ├── About.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── ui/              # primitives (Button, Card, Dialog, ...)
│   │   ├── PhoneCard.tsx
│   │   ├── PhoneRow.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── CapacityBar.tsx
│   │   ├── StatCard.tsx
│   │   ├── BootProgress.tsx
│   │   ├── AboutPhone.tsx
│   │   ├── HealthBanner.tsx
│   │   ├── LogViewer.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── BulkActionBar.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── EmptyState.tsx
│   │   └── StepIndicator.tsx
│   ├── store/               # Zustand — UI state only (NEVER server data)
│   │   ├── ui.ts            # sidebar, theme, command palette, bulk selection
│   │   ├── settings.ts      # hydrated from main at boot (§8.5)
│   │   └── transient.ts     # wizard draft, unsaved forms
│   ├── api/
│   │   ├── client.ts                # fetch wrapper
│   │   ├── query-client.ts          # TanStack Query setup + defaults
│   │   ├── websocket.ts             # raw WS connection manager (singleton)
│   │   ├── ws-bridge.ts             # WS → query cache bridge (mounted once at root)
│   │   ├── ws-schemas.ts            # zod schemas for every WS event
│   │   ├── queries/                 # one file per resource
│   │   │   ├── usePhones.ts         # useQuery + useMutation hooks
│   │   │   ├── useSnapshots.ts
│   │   │   ├── useApks.ts
│   │   │   ├── useProxies.ts
│   │   │   ├── useFingerprints.ts
│   │   │   ├── useHealth.ts
│   │   │   └── useLogs.ts           # useInfiniteQuery + WS append
│   │   ├── endpoints/               # raw REST functions (used by query hooks)
│   │   │   ├── phones.ts
│   │   │   ├── snapshots.ts
│   │   │   ├── apks.ts
│   │   │   └── ...
│   │   └── types.ts
│   ├── ipc/
│   │   ├── index.ts         # typed wrapper around window.cp
│   │   ├── schemas.ts       # zod schemas for IPC payloads (shared with electron/)
│   │   └── types.ts
│   ├── error/
│   │   ├── AppErrorBoundary.tsx
│   │   ├── RouteErrorBoundary.tsx
│   │   └── ErrorFallback.tsx
│   ├── router/
│   │   ├── index.tsx        # createMemoryRouter + lazy route map
│   │   └── preload.ts       # preload-on-hover helpers
│   ├── hooks/
│   │   ├── useShortcut.ts
│   │   ├── useTheme.ts
│   │   ├── useBackendState.ts
│   │   ├── useReducedMotionSafe.ts
│   │   └── useWsEvent.ts
│   ├── lib/
│   │   ├── cn.ts            # clsx + tailwind-merge
│   │   ├── format.ts        # bytes, time, percent
│   │   ├── ids.ts           # slug, short-id
│   │   ├── validation.ts    # shared zod schemas
│   │   ├── parse-maps-url.ts # Google Maps URL → {lat,lng}
│   │   └── cities.ts        # city preset table for §6.4 Step 4
│   ├── components/ui/
│   │   ├── ...primitives
│   │   ├── EditableText.tsx
│   │   └── Skeleton/
│   │       ├── Skeleton.tsx         # base
│   │       ├── PageSkeleton.tsx     # generic page fallback
│   │       ├── PhoneCardSkeleton.tsx
│   │       └── TableRowSkeleton.tsx
│   ├── i18n/
│   │   └── en.ts
│   ├── styles/
│   │   └── global.css       # @tailwind base/components/utilities + tokens
│   └── tests/
│       ├── setup.ts
│       └── ...mirror src layout
├── tailwind.config.ts
├── postcss.config.js
├── electron.vite.config.ts
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── package.json
```

Every file has a single, focused responsibility. If a file passes ~250 lines, split it.

---

## 10. Theme implementation

### 10.1 FOUC prevention (inline pre-React script — mandatory)

If `<html class="dark">` is applied after React mounts, you get a flash of light theme during boot. Solution: an inline script in `index.html` `<head>`, executed before React loads, that sets the class synchronously from the cached preference.

```html
<!-- index.html, in <head>, BEFORE any other script -->
<script>
  (function () {
    try {
      var stored = localStorage.getItem('cp.theme'); // 'light' | 'dark' | 'system' | null
      var resolved = stored;
      if (!stored || stored === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (resolved === 'dark') document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = resolved;
    } catch (e) { /* no-op; falls back to dark default */ }
  })();
</script>
```

This is the **only** allowed inline `<script>` — keep CSP `script-src 'self'` and rely on a build-time inliner (`vite-plugin-html` or hand-injected) to embed this exact snippet without violating CSP (use a build-emitted SHA-256 hash in CSP if strict).

### 10.2 React side

- `<ThemeProvider>` in `main.tsx` reads stored theme from `useSettingsStore` (already hydrated, §8.5) + system preference.
- Manages the `<html class="dark">` class (the inline script set the initial value; React keeps it in sync after).
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` for `system` mode.
- Writes theme changes to both `localStorage.cp.theme` (so the next boot's inline script reads it) AND via `window.cp.setSetting('theme', value)` (electron-store, so settings page reflects it).
- `useTheme()` returns `{ theme, resolvedTheme, setTheme }`.
- `ThemeToggle` cycles: light → dark → system → light. Icon reflects `resolvedTheme`.

---

## 11. Testing strategy

Keep it pragmatic — this is a single-user desktop app, not a SaaS.

**Must test (vitest + RTL):**

- **Query cache / WS bridge** (`src/api/ws-bridge.test.ts`): given a sequence of WS events + optimistic mutation results, assert final cache state per §7.6 precedence rules. This is the trickiest correctness surface — invest here.
- **Zod schemas** (`src/api/ws-schemas.test.ts`, `src/ipc/schemas.test.ts`): valid + invalid payloads parse / reject correctly. Snapshot real backend payloads as fixtures.
- **Stores:** `ui.ts`, `settings.ts` mutations + persistence whitelisting (no leaked secrets to localStorage).
- **Hooks:** `useShortcut`, `useTheme` (incl. system mode + media query mock), `useReducedMotionSafe`.
- **Error boundaries:** AppErrorBoundary and RouteErrorBoundary catch a thrown child, render fallback, retry resets, route change resets.
- **Pure utils:** `lib/format.ts`, `lib/ids.ts`, `lib/parse-maps-url.ts`, validation schemas.
- **Critical components:** `Sidebar` collapse behavior, `CreatePhone` step validation, `ConfirmDialog`, `EditableText` (commit/cancel/validation), `LogViewer` virtualization smoke (mount with 50k lines, assert DOM node count < 100).

**A11y smoke (vitest + `axe-core/react`):** Dashboard, Phones, PhoneDetail, CreatePhone, Settings — each renders and `axe` returns zero violations in dark and light theme.

**Reduced-motion:** mock `matchMedia('(prefers-reduced-motion: reduce)')` true; assert framer-motion durations are 0 and no `animate-pulse` classes appear on status pills.

**Don't test:** page snapshots, every visual variant, IPC wiring beyond the schema layer (mock `window.cp` at the boundary).

E2E (deferred — Phase 6+): Playwright against built app, focused on Create Phone happy path + Start/Stop end-to-end.

---

## 12. Acceptance criteria

The frontend is "done" when:

1. **Shell:** sidebar collapses/expands with animation, persists state, keyboard shortcut works, tooltips appear in collapsed mode, no layout shift.
2. **Theme:** dark/light/system all render correctly, all colors come from tokens (no hard-coded hex outside `global.css`), persists across restart. **No FOUC** on launch (inline script applies theme before first paint — verify by throttling CPU 6× and observing).
3. **Phones list:** grid + table both work, filters narrow the list, bulk select + bulk actions confirmable, empty state shows for zero phones, skeletons during initial load.
4. **Create wizard:** all 5 steps validate, draft persists across refresh, progress page shows live boot events, redirects to detail on RUNNING. GPS step supports paste-URL, presets, and manual modes.
5. **Phone detail:** all 6 tabs render, switching tabs preserves header, start/stop/scrcpy actions work end-to-end, status pill reflects WS events within 500ms. Inline name edit commits on blur/Enter, reverts on Esc, validates slug rules.
6. **WebSocket:** disconnect indicator shows, auto-reconnects with backoff, **on reconnect all queries refetch** (verified by killing the sidecar, restarting, asserting cache rehydrates), stale-data badge appears after 30s without events.
7. **Command palette:** opens with shortcut, navigates, executes actions, shows recent. cmdk lazy-loaded (chunk doesn't appear in main bundle).
8. **Toasts:** success/error/loading variants used consistently for mutations.
9. **A11y:** keyboard-only navigation possible end-to-end; focus visible everywhere; no Radix warnings in console. `axe-core` smoke tests pass on all major pages in both themes. WCAG AA contrast verified for all status pill text/bg combos.
10. **Performance:** sidebar collapse stays at 60fps; phones list with 50 cards scrolls smoothly; **log viewer sustains 200 lines/sec without drops** (virtualized, rAF-batched); no layout thrash on WS bursts.
11. **Bundle budgets enforced** (size-limit CI): main ≤ 180 KB gzip, Dashboard ≤ 80 KB, CreatePhone ≤ 70 KB, others ≤ 50 KB.
12. **Reduced motion:** with OS `prefers-reduced-motion: reduce`, sidebar collapse is instant, page transitions disabled, no `animate-pulse`. Verified manually and in tests.
13. **Error boundaries:** crash inside any route shows route fallback with Retry; crash outside a route shows global fallback with Reload App. Errors forwarded to electron-log.
14. **Security:** CSP meta tag present in production HTML (verified post-build), BrowserWindow flags locked per §8.4, no `unsafe-eval` in production CSP, IPC schemas reject malformed payloads.
15. **No console errors or warnings** in dev or built app.
16. **Type-safe:** `tsc --noEmit` passes; no `any` outside `ipc/types.ts` and `api/types.ts` boundary shims.
17. **Server state purity:** grep for `phones` in `src/store/` returns nothing. Server data lives in TanStack Query, never Zustand.

---

## 13. Out of scope (do NOT build)

- Live scrcpy embedding in the renderer (uses native window).
- Direct Docker/ADB calls from the renderer.
- Multi-user, accounts, RBAC, billing.
- Cloud sync / remote backend / web client.
- Automation runtime (skeleton page only, §6.10).
- Built-in APK signer / repackager.
- Map widget for GPS (lat/lng inputs only for now).
- Telemetry, analytics.
- ~~Update mechanism~~ — **now in scope** via electron-updater (§17). About page button is wired.

---

## 14. Build order (recommended sequence)

1. **Scaffold:** install deps (incl. TanStack Query, react-error-boundary, react-virtual). Configure Tailwind with all color tokens. Set up `QueryClientProvider`, `<AppErrorBoundary>`, `<ThemeProvider>` at app root. Apply Electron security flags (§8.4) and CSP meta tag (§8.4). Inline theme script in `index.html` (§10.1). shadcn-style `ui/` primitives. Create `Shell` + `Sidebar` + `TopBar` + `StatusBar` with collapse and theme toggle working.
2. **Routing + lazy + boundaries + empty pages:** `createMemoryRouter` + `React.lazy` + `<Suspense fallback={<PageSkeleton />}>` + `<RouteErrorBoundary>` for every route. Each renders `PageHeader` + `EmptyState`. Verify navigation, breadcrumbs, and a deliberate crash inside one route shows route fallback (not global).
3. **WS bridge + query client wiring:** mount `ws-bridge.ts`, define schemas, wire `usePhones` query + the WS-cache bridge per §8.1.a / §8.3. Disconnect-reconnect refetch verified end-to-end before any UI work.
4. **Phones list (grid):** wire to `usePhonesQuery` + WS. Cards render live. Verify optimistic start/stop with §7.6 precedence rules.
5. **Phone detail Overview + Logs:** prove virtualized log viewer at 200 lines/sec; per-phone WS subscription.
6. **Create wizard:** all steps, validation, draft persistence, GPS step (paste-URL + presets + manual).
7. **Phones list (table) + bulk actions.**
8. **Phone detail remaining tabs.**
9. **Dashboard** (visx charts in their own chunk).
10. **Snapshots, APK Library, Network, Fingerprints, Settings, About.**
11. **Command palette** (cmdk lazy-mounted on first ⌘K) **+ shortcuts cheatsheet.**
12. **Automation skeleton.**
13. **Polish:** motion + reduced-motion paths, empty states, focus styles, a11y sweep with axe, performance pass (rAF batching on WS bursts).
14. **Packaging:** electron-builder config, code signing setup, auto-update wiring via electron-updater (§17). Verify signed installer launches clean on a fresh VM.

Commit after each numbered step. Each commit should leave the app runnable.

---

## 15. Final notes for the implementer

- **Match the design tone**, not just the structure. Whitespace > borders. Subtle color > saturated color. Type > icons when both fit.
- **No emojis in code or UI** unless this prompt explicitly says so. (None do.)
- **No comments in code** unless explaining a non-obvious why.
- **YAGNI:** if you find yourself building "just in case", stop. This doc lists what to build; everything else is no.
- When in doubt about the visual look, study: Linear app, Vercel dashboard, Raycast, Tailwind UI, shadcn examples. Mimic their restraint.

---

## 16. Security hardening (consolidated)

A checklist; every item is mandatory unless explicitly waived in writing in this section.

### 16.1 Electron process model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`. Locked at window creation (§8.4). Any PR that loosens these must add a justification block here.
- Preload script is the only renderer ↔ main bridge. No `ipcRenderer` or `require` reachable from page JS.
- `app.on('web-contents-created')` blocks `window.open`, `will-navigate`, and `will-attach-webview`.
- Production builds use `app.enableSandbox()` before `app.whenReady()`.

### 16.2 CSP

- Production CSP locked per §8.4 (no remote origins, no `unsafe-eval`).
- `'unsafe-inline'` in `style-src` is the only inline allowance (required by Tailwind/Radix). All other inline content needs a hash-based allowance.
- The one inline `<script>` (theme FOUC bootstrap, §10.1) is included via build-time hash injection into the CSP, not blanket `'unsafe-inline'` in `script-src`.

### 16.3 IPC contract

- Every IPC channel has a zod schema for both input and output.
- Main-side handlers `safeParse` input before any side effect; on failure, throw a typed error.
- Renderer preload `safeParse`s payloads it receives from main.
- No `ipcRenderer.invoke('arbitrary', ...)` — every call goes through a named `window.cp.*` method.

### 16.4 Network surface

- Renderer only talks to `127.0.0.1:<sidecar-port>` over HTTP and WS. Enforced in CSP `connect-src`.
- No third-party telemetry, analytics, font CDN, or asset CDN. All assets self-hosted.
- `openExternal` is the only way to launch a URL; it validates `https://` only and rejects custom protocols.

### 16.5 Dependency hygiene

- `npm audit` clean on `--omit=dev` at build time (CI fails on any high/critical).
- Dependencies pinned to caret ranges; lockfile committed; renovate config for staged updates.
- No optional native modules unless explicitly required; if added, sign + notarize the unpacked binary.

### 16.6 What is explicitly allowed

- Local file dialogs via `showOpenDialog` (for APK upload, etc.) — files are passed back as opaque paths, not contents.
- Local filesystem reads/writes happen only in main, never renderer.
- WSL and Docker calls happen only in the Python sidecar, never in Electron.

### 16.7 What is explicitly denied

- Remote HTTP requests from renderer (CSP-blocked).
- Loading arbitrary URLs in the BrowserWindow (`will-navigate` denied).
- Spawning child processes from renderer (no Node access).
- Reading env vars or file system from renderer.

---

## 17. Build, packaging, and auto-update

### 17.1 Build-time injection

`vite.config.ts` defines:

```ts
import { execSync } from 'node:child_process';
import pkg from './package.json';

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const buildDate = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  ...
});
```

`__APP_VERSION__`, `__COMMIT__`, `__BUILD_DATE__` are referenced in the About page (§6.12). No git access at runtime.

### 17.2 electron-builder config (`electron-builder.yml`)

- `appId: com.cloudphone.manager`
- `productName: CloudPhone Manager`
- `asar: true`; `asarUnpack:` only native modules that misbehave inside asar (none expected for this app).
- Targets:
  - **Windows:** `nsis` installer (per-user by default, machine-wide optional), portable build for power users.
  - **macOS:** `dmg` (x64 + arm64 universal), `mac.category: public.app-category.developer-tools`, hardened runtime enabled, entitlements file for network client only.
  - **Linux:** `AppImage` + `deb`.
- Publish provider: `github` (Releases), draft on `main` tag push.

### 17.3 Code signing

- **macOS:** Apple Developer ID Application cert. `notarize: true` via `notarytool` API key (`APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY` in CI secrets). Notarization step blocks the publish job until ticket attaches.
- **Windows:** EV code signing cert preferred (SmartScreen warm reputation). Standard OV cert acceptable as fallback. Sign both the installer and the inner `.exe`.
- **Linux:** unsigned AppImage / gpg-signed `.deb`.

### 17.4 Auto-update (electron-updater)

- Wire `electron-updater` in main; on `app.whenReady()` call `autoUpdater.checkForUpdatesAndNotify()` once per launch (debounced — don't pester).
- Settings → Advanced has "Check for updates" button that re-runs check; result toast.
- About page button (§6.12) opens the latest GitHub release in the user's browser as a fallback when auto-update fails.
- Update channel: `latest` (stable). Pre-release channel `beta` available via opt-in setting (default off).
- After download, install on quit (`autoUpdater.autoInstallOnAppQuit = true`). No silent forced restart.

### 17.5 CI pipeline (GitHub Actions outline)

- `lint-test`: `tsc --noEmit`, `eslint`, `vitest run`, `size-limit` (bundle budgets, §7.12).
- `build`: matrix [windows-latest, macos-latest, ubuntu-latest], electron-builder produces signed artifacts.
- `publish`: only on tag push to `main`. Drafts a GitHub Release with all platform artifacts attached, including the `latest.yml` / `latest-mac.yml` / `latest-linux.yml` manifests that electron-updater consumes.

### 17.6 Reproducible-ish builds

- Lockfile committed; `npm ci` (not `install`) in CI.
- Build timestamp injected (above) for traceability, not for "diff bit-for-bit" reproducibility — full reproducibility is out of scope.

---

End of prompt.
