# Hubb HA UI: Repository Conventions (for AI agents)

A Home Assistant **frontend plugin**, distributed through HACS (category Dashboard): a dashboard
strategy (`custom:hubb`) plus Lit cards that build the Hubb home screens from the areas, devices and
entities Home Assistant already knows. One code base for every Hubb client, whatever the hardware
(ControlArt relay and dimmer, KinCony relay and IR).

Design spec: `homeassistant` repo, `docs/superpowers/specs/2026-10-09-hubb-ha-ui-design.md`; scope
v2 (any kind of place, panel editor, phases M1.1 to M4) in `2026-10-10-hubb-ha-ui-escopo-v2.md`; one
spec per phase after it (`...-m2a-design.md`, `...-m3-design.md`, `...-m4-design.md`). They name the
clients and their houses, so they never come to this public repository.

## Language

- Code, comments, README, CHANGELOG, commit messages: **English**.
- Resident-facing strings: **Brazilian Portuguese with full accents**, all in `src/strings.ts`,
  gender-neutral (room names come from the client).
- **Never use em dashes or en dashes** anywhere.

## Layout

```text
src/
  ha/types.ts          the slice of the frontend `hass` object we read; infrared.ts (platforms
                       whose state is the last command sent)
  model/               pure rules (no DOM): config (tolerant reader), profiles, classify (the one
                       rule that places every entity), appliances, floors, review, buildHouse,
                       names, paths, energy (power and energy sensors of a switch), gate-sensor
                       (the sensor of a pulse gate: its position, candidates, the relay's last pulse)
  model/media.ts       what a speaker plays (its own attributes, then the Spotify playing on it,
                       matched by its source), who takes a command, the group and its candidates
  model/               tablet: layout (layoutFor), tablet (tablets.<user>, rest rules, the app's
                       screen commands), pick-room, pills, weather, scene-icon
  summary.ts           the home headline, room lines and room sensors
  strings.ts           every resident string
  actions/             light (by domain), colour, switch, action, scene, pending (3 s window),
                       undo (5 s), clipboard, dashboard-config (the review saves roles), people
                       (the users, for hidden_for), entity-area (the one registry write), haptic,
                       navigate, climate and media (feature bits and the words of a state), energy
                       (watts, today's kWh from the statistics)
  theme/               CSS tokens (screens only) and the embedded Manrope font
  art/                 the 59 room drawings, the name/icon resolver, the render helper
  editing.ts           the edit mode (module state: it survives the view rebuild after a save)
  sheets.ts, layout.ts, selection.ts, actions/rest.ts, server-clock.ts, actions/climate-target.ts
                       module state too: the open sheets, the layout and size of the screen, the
                       rail put away, the room picked on the wide home, the rest of a wall
                       tablet, how far this device's clock is from the server's, the target asked
                       of an air conditioner (shared by its card and its sheet)
  elements/            toggle tile (light, outlet, equipment, fan), action button, appliance card and
                       panel, floor tabs, item editor, sheet, dimmer and colour panels, toast, nav bar, room card,
                       scene button; M3: slide-confirm and access tile, climate card and panel,
                       cover tile and panel, media card, panel, progress, group (Tocar junto) and
                       browse (Tocar algo);
                       M4: status strips, alarm card,
                       camera tile, power panel
  screens/             home, room, scenes, security, media (Mídia), review (each is a Lovelace card
                       filling a panel view)
  cards/               standalone light card, error card
  strategy/            generateDashboard, the ll-strategy-dashboard-hubb element and
                       place-editor (the kind of place Home Assistant asks at creation)
  hubb-ha-ui.ts        entry: registers everything, injects the font
dev/                   preview.html + mock-house.js (a made-up house drawn by the real bundle),
                       serve.mjs; `npm run preview`. The README screenshots come from it
test/                  Vitest + happy-dom; helpers/fake-hass.ts; fixtures: sample-house (a real
                       house, anonymised), clinic, casa-exemplo-2 (switch lights, washer), washer
```

## Commands

- `npm ci` then `npm run check` (typecheck, tests, build). All of it runs on Windows, no Home
  Assistant server needed.
- `dist/hubb-ha-ui.js` is the only artefact. It is git ignored and published as a Release asset by
  `.github/workflows/release.yml` on a `vX.Y.Z` tag.

## Conventions

- **No decorators.** `static properties` plus `declare` fields set in the constructor.
- Only screens and standalone cards include `tokens`; inner elements read `var(--hubb-*)`.
- Cards never read the registries; the strategy passes entity ids in the card config.
- Never call `config/*_registry/list` from the frontend: admin only. Use `hass.areas`,
  `hass.devices`, `hass.entities`.
- The one registry write is `config/entity_registry/update` with the `area_id` of one entity
  (`actions/entity-area.ts`, from Revisar, administrators only). Never the area of a device: a relay
  board is one device for all its channels, and its area moves every one of them. Roomless switches
  (`roomlessSwitches` in `model/review.ts`) stay out of `reviewItems` and its count: they are behind
  "Mostrar interruptores sem cômodo" only. Every move rebuilds the dashboard and the review screen with it, so
  what the installer is in the middle of (the list open, the rooms chosen, the place in the list)
  lives in module state keyed by `hass.callService` (`kept` in `screens/review-screen.ts`).
- Dashboard URLs need a hyphen in Home Assistant (`hubb-casa`), so screens derive their base path
  from `location.pathname`.
- The `h.` glyph never appears in the panel.

## Release

CalVer `YYYY.M.R`. **A version only when Gustavo orders it**: until then every change lands in
`[Unreleased]` and the version stays put. Then, in this order:

1. `npm run check` green.
2. CHANGELOG: `[Unreleased]` becomes `## [YYYY.M.R] - YYYY-MM-DD` under a fresh empty
   `[Unreleased]`, and the footer gets the new compare link; validate with
   `pwsh -File ~/.claude/skills/changelog/scripts/check-changelog.ps1`.
3. `version` in `package.json` and in both entries of `package-lock.json` (the build injects it
   into `src/version.ts`; `test/version.test.ts` keeps them in step).
4. Commit `feat:` or `fix:` with the version in the subject (`... (2026.10.8)`), staging the files by
   name; push `master`; annotated tag `vYYYY.M.R`; push the tag.
5. Wait for CI and Release (`gh run list`); the Release must carry `hubb-ha-ui.js`, which is what
   HACS serves.
6. Houses update through HACS (Redownload) only with Gustavo's approval, house by house. Client
   accounts are not administrators: installer features stay invisible to them.

Never commit, push, tag or touch a house without Gustavo's explicit approval; one approval covers one
operation.

## Gotchas

- `dev/mock-house.js` is public: every name and value in it is made up, never a client's. After a
  visual change, retake the README screenshots from `npm run preview` at 390 x 844 into
  `docs/images/` (same file names) and keep the README image links absolute (HACS).

- happy-dom has no layout: tests that need sizes mock `getBoundingClientRect`.
- `haptic` is a window event the Companion App turns into vibration; browsers ignore it.
- The undo offer lives in module state of `elements/toast.ts`, shared by every screen's toast, so it
  survives a view switch within its 5 s. Tests that show one withdraw it with `hide()`.
- Home Assistant stops sending `hass` to a hidden cached view. Undo reads the newest hass any screen
  got (module state in `screens/base.ts`), not the one of the screen that started the action.
- A tile keeps one timer, re-armed after every render from `PendingTracker.msUntilChange`; it also
  re-arms on reconnect, because a view switch disconnects the tile and drops the timer. The access
  tile does the same with its own deadline (`#arm`).
- The wait of a pulse gate with a sensor is module state of `elements/access-tile.ts`, keyed by
  `hass.callService` like the users of `actions/people.ts`, so the card on the room page and the one
  on Segurança agree; the pulse is also read on the relay itself (`relayPulsedAt`: a switch that is
  off again counts from 2 s before its last change), which is how another phone sees it, and this
  phone's own pulse coming back is not read twice (`own`). A bare pulse waits with no direction. A
  wrong wait only takes the tap of Fechar away, a missed one offers it: when in doubt, wait. A pulse
  from the remote control is invisible to both.
- HACS serves only `hubb-ha-ui.js`, which is why the font is inlined.
- The header and sidebar of Home Assistant are hidden for residents by kiosk-mode (a separate HACS
  plugin), never by this code: the strategy returns `kiosk_mode` (`KIOSK` in `strategy/generate.ts`)
  and Home Assistant keeps whatever a strategy returns as the dashboard config, which kiosk-mode
  reads. Reaching into the DOM of Home Assistant ourselves would break with its releases.
- `vite.config.ts` is outside `tsc` on purpose: it uses `node:fs` and would need `@types/node`.
- Room drawings go into the page through `unsafeSVG`. Only `src/art/drawings.ts` may feed it, and
  `test/art/drawings.test.ts` keeps that file to plain shapes with no colours, links or handlers.
  A new drawing also needs its words in `src/art/resolve.ts` and a row in `docs/drawings.md`.
- An outlet is a `switch` whose state attribute `device_class` is `outlet`: `hass.entities` does
  not carry the device class. Bulk actions and undo read `room.lights` only, on purpose.
- `src/model/classify.ts` is the one rule that decides where an entity goes. The panel, "Revisar o
  painel" and, later, the editor all call it; never place an entity anywhere else.
- Opening the house (a gate, a lock, a pulse relay with the `gate` role) only ever goes through
  `hubb-slide-confirm`: a drag to 85% or the right arrow to the end. A tap must never open; keep
  that test green. The one tap that pulses a gate is Fechar on a pulse relay whose sensor
  (`entities.<id>.sensor`, `src/model/gate-sensor.ts`) says open; while the gate is on its way or the
  sensor does not answer, the card falls back to the slide ("Deslize para acionar").
- View order is fixed: `home`, `scenes`, `seguranca`, `midia`, then `revisar` (admin), then one per
  HA area by id. `seguranca` and `midia` are always generated (the bar hides the tab when the house has
  nothing for it; `midia` needs two or more speakers for whoever looks, `Shared.mediaTab`);
  an area with a fixed id gets `area-<id>` (`src/model/paths.ts`).
- Every screen gets `shared` (alerts and whether the security tab exists) from the strategy and
  draws `hubb-status-strips` through `HubbScreen.strips()`. The buzz of a new alert is module state,
  so a view switch does not buzz again.
- The camera image is taken once per opening of the security tab (`connectedCallback`), signed then
  with `auth/sign_path` (a hidden view keeps an old `hass` whose token may have expired), never on a
  new `hass`: a refreshing image used up the free Cloudflare traffic of a client. Keep it that way.
- `hubb-sheet` closes on its backdrop only when the touch began there: on an iPhone the release of
  the long press that opened it sends a click to the backdrop. A test pins it.
- Values of climate attributes that neither `CLIMATE.fanWords` nor Home Assistant can name never
  reach the sheet (`knownWord`, `namedValues`); add a word there before showing a new value. Ours
  come first: they agree with the feminine headings ("Ventilação", "Oscilação"), Home Assistant's
  are masculine. The item editor offers a setting only when the sheet would show it.
- **One command per drag.** The arc of the air conditioner's sheet (`elements/climate-arc.ts`) shows
  the target under the finger and asks for it once, when the finger lets go (`hubb-arc-change` with
  `source: 'pointer'`); LG ThinQ, Electrolux through the cloud and infrared take one command per
  change. − and +, on the card and on the sheet, and the keys of the arc wait 800 ms for the next tap
  (`SEND_AFTER_MS`). The target asked is module state in `actions/climate-target.ts`, per connection,
  so the card and the open sheet show the same one. A target Home Assistant does not show within
  `HOLD_MS` (6 s; LG ThinQ shows one in about 3 s) was not taken: `onTargetNotTaken` shakes the card
  and puts "O ar não aceitou 21°." on the sheet (an LG in Auto ignores all but 18 and 19, no error). The angles are pure functions in
  `src/model/arc.ts` (happy-dom draws nothing); the drag is tested with pointer events, and it never
  closes the sheet (`test/elements/climate-sheet-arc.test.ts`).
- The switches, selects and numbers of a device with an air conditioner on the panel are its
  functions (`classify` gives them `part`): `climateExtras` in `build-house.ts` puts them on its sheet,
  leaving out the power switch (`isPowerTwin`), diagnostics and entities with a role. Names an
  integration leaves in English, or that mislead (LG ThinQ's "Iluminação" is the light of the
  display: "Luz do display"), get a word in `CLIMATE.extraWords`, by translation key or by name.
- Who sees what is decided in the model, never in a screen: `viewerOf` (`src/model/visibility.ts`)
  is null for an administrator, so nothing is filtered for them; `buildHouse` drops rooms and items
  for the resident looking, `classify` returns `viewer`, `generateDashboard` skips the view. Danger
  alerts always pass. `config/auth/list` is admin only: only the edit mode, the item editor and the
  review call it (`loadUsers`).
- Cenas and Segurança follow who sees what too: `tabs.<tab>.hidden_for` (`tabHiddenFor`), and a tab
  with nothing for a resident gets the redirect card in its view and leaves the bar
  (`Shared.scenes`, `Shared.security`). Their edit mode shares `peopleSheet`, `hiddenForOf` and
  `hideItem` from `HubbScreen`. The alarm always passes `classify` (its alert reaches everyone);
  `buildHouse` drops only its card for whoever it is hidden for.
- **A tap inside a sheet never closes it**, unless the maintainer asks for that one by name. Home
  Assistant regenerates a strategy dashboard after every save and whenever `hass.entities`,
  `devices`, `areas` or `floors` change (any registry update in the house, such as the WiiM group
  player hiding itself when speakers join), and the new screens replace the old ones. So every open
  sheet is module state in `src/sheets.ts`: each screen lists the properties that open its sheets in
  `static keptSheets` (one per `hubb-sheet` it draws), `HubbScreen.willUpdate` hands them to the
  rebuilt screen, and only closing the sheet, leaving the edit mode or coming back more than
  `REBUILD_MS` later forgets them. A new sheet adds its property there; `test/sheets-rebuild.test.ts`
  counts the sheets of every screen against the list and reopens each one after a rebuild. A new
  action inside a sheet gets a test that the sheet is still open after the rebuild.
- **Three layouts, by the size of the screen element, never of the window** (the sidebar of Home
  Assistant takes part of it): `phone` under 600 px, `roomy` from 600 (or a screen under 600 px
  tall), `wide` from 900 by 600 (`layoutFor`, `src/model/layout.ts`). A `ResizeObserver` on each
  screen reports to `src/layout.ts`, which sets `screenLayout` on every screen and element that asks
  through `LayoutWatcher`, and the area variables (`--hubb-area-left`, `-top`, `-width`) the fixed bar,
  sheet and toast centre on. The attribute is `screen-layout`, never `layout`: `hui-panel-view` sets
  `card.layout = 'panel'` on every card, which overwrote ours.
- **Everything that must survive the rebuild is module state**, like `editing.ts`: the open sheets
  (`sheets.ts`), the layout (`layout.ts`), the room picked on the wide home (`selection.ts`, also kept
  in `localStorage` per dashboard) and the rest of a wall tablet (`actions/rest.ts`, by the clock, so
  a held-back timer only fires late). A property of the screen is lost at the next registry change.
- **A time from Home Assistant is on the server's clock.** `media_position_updated_at` and the like
  are compared with `Date.now() - serverSkew()` (`src/server-clock.ts`, learned from the states as
  they arrive), never with `Date.now()` alone: an iPad 74 s ahead showed a song just started at 1:14.
- The wide home draws the room picked as `hubb-room-screen embedded` in its right pane. An embedded
  screen draws no strips, back arrow, pencil, toast or bar, does not measure the screen and does not
  run the rest. A room page opened on a wide screen picks its room and goes to the home.
- **Screen brightness only through the Home Assistant app**, by `notify.mobile_app_*` commands built
  in `screenCalls` (`src/model/tablet.ts`): iPadOS `kiosk_set_brightness` (`level` 0 to 100, Kiosk
  mode on); Android `command_auto_screen_brightness` off, then `command_screen_brightness_level`
  (0 to 255, needs "Modify system settings"), and back on at wake, plus `command_screen_on` with
  `keep_screen_on`. A refused command is let go: resting still shows the rest screen. The screen is
  never turned off, so presence and touch can wake it.
- A text that names the place takes a `Place` (`STRIP.offline`, `SECURITY.empty`, `EDIT.onlyAdmins`):
  "a casa" for a home, "o local" for a business (`Shared.place`, from the profile). A new resident
  string that would say "casa" does the same, or says it without the place.
- The blocks of a room page and the list of Cenas are six-column grids: a card takes 2 (small), 3
  (medium) or all 6 (large) columns through a `size-*` class from `sizeOf` (`src/model/sizes.ts`).
  On a tablet (`roomy`, `wide`) they are twelve columns, 3, 6 or 12 (`gridSpans`, `src/theme/layout.ts`),
  so a small card is a quarter of the row; a scene with no size is small there. Cards with buttons or a slide only take the whole row. The span rules name the size class
  (`.grid > .size-small`): an edit tile resets its own styles with `all: unset`, which would undo a
  rule as weak as `.grid > *`.
- happy-dom miscounts the options Lit renders in a `<select>` (`selectedIndex` lands on the wrong
  one): tests read the `selected` attribute instead.
- A select of a device starts with `unlisted(...)` (`src/elements/unlisted.ts`): with no value, or one
  that is none of its choices, the browser would show the first choice, and picking it sends nothing.
- Block order on a room page is fixed (Acesso, Luzes, Clima, Cortinas, Mídia, Tomadas e
  equipamentos, Aparelhos, Ações, Sensores). One exception, wide only: a room with both an air
  conditioner and a player draws Clima and Mídia side by side (`.pair.both`), so Cortinas comes after
  them. The climate, cover, media and consumption sheets are one
  `hubb-sheet.device` opened by `hubb-open-climate`, `hubb-open-cover`, `hubb-open-media` and
  `hubb-open-power`.
- A Spotify `media_player` is never a card (classify drops it): it shows through the speaker whose
  name is its `source`. `Shared.media` carries the players the resident sees, so Tocar junto never
  offers a speaker hidden for them. The channel select is found by `channelSelect` (`translation_key
  === 'output_channel'` on the speaker's device), never by entity id. WiiM's "Group Master" player
  (attributes `group_leader` and `group_status`) is dropped by classify: WiiM unhides it whenever a
  group forms. A member's sheet reads and commands the leader (`group_role: master`), whose copy on
  the member goes stale. A paused Spotify only fills a
  speaker that is paused too. `volumeTarget(hass, id)` keeps one target per speaker (keyed by
  `callService`), shared by the sheet and Volume de todas; closing the sheet sends a level still
  gathering instead of dropping it.
- Music Assistant (spec Multiroom): `model/ma-pair.ts` pairs each speaker with its Music Assistant
  player by device name and model (`entities.<id>.music_assistant` overrides); classify drops the
  paired player (`part`), Music Assistant group players and every `alexa_media` player (role `media`
  brings one back). `MediaItem.ma` and `Shared.mediaPairs` carry the pair. `musicEntity` decides
  where the music comes from (the Music Assistant player while it plays, or paused with the speaker
  idle); card, mini player, sheet and the Mídia tab use it, while source, volume, power and the Canal
  stay on the speaker. `groupingEntity` makes Tocar junto join through Music Assistant when the
  speaker has a player there. Tocar algo (`model/ma-library.ts`) gets the integration's entry from
  `config_entries/get` (no administrator needed) and calls the actions with `return_response`.
- `cachedStaticReview` keys on the identity of `hass.entities`, `hass.devices`, `hass.areas`,
  `hass.floors` and the configuration object: the frontend keeps those objects across state
  changes, so the home can count the review on every update.
