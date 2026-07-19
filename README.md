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

## Build & run

### Option A — Tizen Studio (recommended)
1. Install **Tizen Studio** with the **TV Extensions**.
2. `File → Import → Tizen → Tizen Project` and select this folder (it already has `config.xml`).
3. Create a **Samsung certificate** (`Tools → Certificate Manager`) and register your TV's DUID.
4. Put the TV in **Developer Mode** (apps → *Apps*, enter `12345`, set your PC IP).
5. Connect with **Device Manager**, then **Run As → Tizen Web Application**.

### Option B — CLI packaging
```bash
tizen build-web -- .
tizen package -t wgt -s <your-cert-profile> -- .buildResult
tizen install -n StoryTimeUniverse.wgt -t <tv-device>
```

### Option C — Desktop design preview
The `tizen-shim.js` stubs the platform APIs, so you can open `index.html` in Chrome to check
layout and navigation with a keyboard (Arrow keys = D‑pad, Enter = OK, Esc/Backspace = Back).
Live API calls require the backend to permit the request origin (see **Networking** below).

---

## Networking & auth notes

- All API calls use `fetch(..., { credentials: "include" })` so the **NextAuth session cookie** and the
  **`st_viewer_profile`** cookie flow with each request. The profile cookie is set server‑side by
  `POST /api/viewer/profiles/active`.
- `config.xml` declares `<access>` origins so Tizen's **WARP** allows cross‑origin requests to the backend
  and to the video CDNs.
- Playback uses the **HTML5 `<video>`** element (with `crossorigin="use-credentials"`) because it carries the
  webview's session cookies to `story-time.online`, which is what the proxied HLS manifest
  (`/api/content/:id/playback-bundle → playback.src`) requires. AVPlay is detected via the shim and can be
  swapped in for sources that don't need cookie auth.
- If your backend enforces strict CORS for TV origins, allow the app origin (or add a thin same‑origin proxy).

---

## Viewer API surface used

| Area | Endpoints |
| --- | --- |
| Auth | `GET /api/auth/csrf`, `POST /api/auth/callback/credentials-viewer`, `GET /api/auth/session`, `POST /api/auth/signout` |
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
