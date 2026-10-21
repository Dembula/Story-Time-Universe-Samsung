# Story Time Universe — Samsung TV (Tizen)

Native **Samsung Smart TV** app for Story Time Universe, written as a **Tizen Web Application**
(the platform's native app format for TVs). It is a 10‑foot, D‑pad‑driven viewer client that
talks to the same production backend as the web and iOS apps (`https://story-time.online`).

It mirrors the viewer flow of the iOS app and the look of the production web build:

**Splash → Sign in → Choose profile → Home / Search / My List / Account → Detail → Player**

---

## Highlights

- **Full viewing surface** — films, series/episodes, trailers, cast & crew credits, "More like this",
  Continue Watching, per‑type rows, search, and My List.
- **Best‑in‑class player** — HLS video with a custom control skin (driven by D‑pad or pointer):
  - Back button + title that **fade out** during playback and fade back on any key press.
  - A **gradient timeline** (orange→gold) with a buffered indicator and scrub knob — **no default white seek bar**.
  - ±10s skip with on‑screen feedback pills, resume from last position, periodic progress save, watch‑session recording.
  - Subtitles, and episode **Up Next** with an auto‑advance countdown.
- **Hybrid TV input** — D‑pad **spatial navigation** everywhere plus full **Smart‑Remote pointer** support.
  The app boots in D‑pad mode (cursor hidden); the moment the air‑mouse moves it flips to pointer mode —
  hovering focuses a card, clicking activates it, and the player timeline is click‑to‑seek. Pressing any
  remote key flips straight back to D‑pad mode and hides the cursor again. Media keys (Play/Pause/FF/RW)
  are supported throughout.
- **Full‑bleed screens** — the Profiles screen uses a rotating **backdrop that covers the whole 1920×1080 screen**;
  Home opens with a production‑style hero carousel.
- **Smooth transitions** — screen crossfades, focus scaling, rail/row easing.
- **No in‑app payments** — Renew / Change plan / Sign up open the web companion, exactly like iOS.

---

## Project layout

```
config.xml              Tizen widget manifest (privileges, WARP network access, TV profile)
icon.png                App launcher icon
index.html              Entry; loads all classic scripts in dependency order
css/
  base.css              Reset, brand theme tokens, transitions, input-mode cursor rules
  layout.css            Side nav, hero, content rows, poster cards
  screens.css           Splash, sign-in, profiles, detail, account
  player.css            Player skin (fading chrome, custom timeline, next-up)
js/
  tizen-shim.js         Platform bridge (registerKeys, setPointerVisible, exitApp, openBrowser, AVPlay check)
  config.js             Base URLs + constants
  dom.js                DOM + formatting helpers
  media-url.js          Image URL candidate resolver (ported from iOS MediaURL)
  catalogue.js          Home row definitions (ported from CatalogueTypes)
  api.js                Viewer API client (ported from ViewerAPI)
  auth.js               NextAuth credentials-viewer sign-in (CSRF flow)
  keys.js               Remote key-code map + global key dispatcher (handler stack)
  focus.js              Geometric spatial-navigation (D-pad focus) engine
  components.js         Reusable renderers (cards, rows, hero, side nav, image fallback)
  player.js             Media player (HLS video + custom controls)
  router.js             Screen router + global app state
  app.js                Bootstrap
  screens/              splash, signin, profiles, home, search, mylist, detail, account
```

---

## App identity (do not change casually)

Samsung enforces strict ID rules. This project is locked to:

| Field | Value | Rule |
| --- | --- | --- |
| Package ID | `Story0Time` | **Exactly 10** alphanumeric chars (`0-9a-zA-Z`). No `@`, spaces, hyphens. |
| Application ID | `Story0Time.StoryTimeUniverse` | `{package}.{ProjectName}` |
| Widget name | `Story Time Universe` | Display name only |

**Wrong examples that will fail install (`download failed[16]` / `was get app info failed`):**
- `3Story0Time` — 11 characters (too long)
- `Story@Time` — `@` is illegal
- `Story Time` — spaces are illegal

Always use **`Story0Time.StoryTimeUniverse`** in uninstall/install commands.

---

## Build & run

### Option A — Tizen Studio (recommended)
1. Install **Tizen Studio** with the **TV Extensions** (Package Manager → TV Extensions).
2. `File → Import → Tizen → Tizen Project` and select this folder (it has `config.xml`, `.project`, `.tproject`).
3. Create a **Samsung certificate** (`Tools → Certificate Manager`) — Author + Distributor — and add your TV/emulator **DUID**.
4. Put the TV in **Developer Mode** (Smart Hub → Apps, enter `12345` on remote, set your PC IP).
5. In **Device Manager**, connect the TV/emulator, then **right‑click → Permit to install applications**.
6. Right‑click the project → **Run As → Tizen Web Application**.

### Option B — CLI packaging (PowerShell helper)
From the repo root (uses your existing `samsungtv` certificate profile):

```powershell
.\scripts\package.ps1
# then, with emulator/TV online + "Permit to install":
.\scripts\package.ps1 -Target emulator-26101
```

Manual equivalent:

```bash
tizen build-web -e ".git/*" -e ".git" -e "README.md" -e "scripts/*" -e "*.md" -- .
tizen package -t wgt -s samsungtv -- .buildResult
# rename spaced output name for CLI:
copy ".buildResult\Story Time Universe.wgt" StoryTimeUniverse.wgt
tizen install -n StoryTimeUniverse.wgt -t emulator-26101
```

If you must use raw `sdb` / `wascmd`, the IDs must match `config.xml` **exactly**:

```bash
# Uninstall (ignore failure if not installed)
sdb -s emulator-26101 shell 0 vd_appuninstall Story0Time.StoryTimeUniverse

# Install — Application ID has NO @ symbol
sdb -s emulator-26101 shell 0 vd_appinstall Story0Time.StoryTimeUniverse /home/owner/share/tmp/sdk_tools/tmp/StoryTimeUniverse.wgt
```

### Option C — Desktop design preview
The `tizen-shim.js` stubs the platform APIs, so you can open `index.html` in Chrome to check
layout and navigation with a keyboard (Arrow keys = D‑pad, Enter = OK, Esc/Backspace = Back).
Live API calls require the backend to permit the request origin (see **Networking** below).

### Common install failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `download failed[16]` | Bad app ID, unsigned `.wgt`, or missing “Permit to install” | Use `Story0Time.StoryTimeUniverse`, re-package with Samsung cert, permit device |
| `was get app info failed` | App not installed / wrong ID on uninstall | Normal if first install; use the exact Application ID above |
| Certificate / privilege mismatch | Partner-only privilege in `config.xml` | This project only uses **public** privileges |
| Import fails in Tizen Studio | Missing project metadata | Repo includes `.project` + `.tproject` — re-import the folder |

---

## Networking & auth notes

Tizen webviews run as `file://` / widget origin. Chromium on 2024–2026 TVs **will not store NextAuth `SameSite=Lax` cookies** on cross-origin `fetch`. Credentialed fetches against `Access-Control-Allow-Origin: *` are also blocked — that broke login when the client used `credentials: "include"`.

The app authenticates with **`POST /api/tv/session`** (`credentials: "omit"`), stores a JWT in `localStorage`, and sends `Authorization: Bearer` on every API call (plus `X-ST-Viewer-Profile` after a profile is chosen). HLS `<video>` requests append `tv_token` because media elements cannot set Authorization. Production middleware maps Bearer / `tv_token` onto NextAuth cookies.

- Desktop preview may fall back to NextAuth cookies; packaged Tizen never does.
- QA viewer accounts must **not** have authenticator MFA enabled.
- **Resubmit as app version 1.0.3** with production middleware covering watchlist/crew/people.

---

## Viewer API surface used

| Area | Endpoints |
| --- | --- |
| Auth | `POST/GET/DELETE /api/tv/session` (primary), `GET /api/auth/csrf`, `POST /api/auth/callback/credentials-viewer`, `GET /api/auth/session`, `POST /api/auth/signout` |
| Profiles | `GET/POST /api/viewer/profiles`, `POST /api/viewer/profiles/active` |
| Catalogue | `GET /api/content`, `GET /api/content/:id`, `GET /api/browse/search` |
| Playback | `GET /api/content/:id/playback-bundle` (films / `episodeId` / `trailer=1`), `GET/PUT /api/watch/progress`, `POST /api/watch`, `GET /api/watch/continue-watching` |
| Credits | `GET /api/crew?contentId=`, `GET /api/people/:id/preview` |
| My List | `GET/POST /api/watchlist` |
| Subscription | `GET /api/viewer/subscription` (read‑only; checkout stays on web) |

---

## Remote controls

| Key | Action |
| --- | --- |
| D‑pad ← ↑ → ↓ | Move focus (spatial); scrub on the player timeline |
| OK / Enter | Select / play‑pause |
| Back (Return) | Go back a screen; from Home → Choose profile; from Sign in → exit |
| Play / Pause / ⏪ / ⏩ | Player transport |
| Yellow | Toggle password visibility on the sign‑in screen |

Demo viewer (if enabled on the production seed): `viewer@storytime.com` — see production `DEMO_ACCOUNTS.md`.
