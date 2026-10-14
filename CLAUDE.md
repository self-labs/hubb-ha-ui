# Hubb HA UI: Repository Conventions (for AI agents)

A Home Assistant **frontend plugin**, distributed through HACS (category Dashboard): a dashboard
strategy (`custom:hubb`) plus Lit cards that build the Hubb home screens from the areas, devices and
entities Home Assistant already knows. One code base for every Hubb client, whatever the hardware
(ControlArt relay and dimmer, KinCony relay and IR).

Design spec: `homeassistant` repo, `docs/superpowers/specs/2026-10-09-hubb-ha-ui-design.md`; scope
v2 (any kind of place, panel editor, phases M1.1 to M4) in `2026-10-10-hubb-ha-ui-escopo-v2.md`.

## Language

- Code, comments, README, CHANGELOG, commit messages: **English**.
- Resident-facing strings: **Brazilian Portuguese with full accents**, all in `src/strings.ts`,
  gender-neutral (room names come from the client).
- **Never use em dashes or en dashes** anywhere.

## Layout

```text
src/
  ha/types.ts          the slice of the frontend `hass` object we read
  model/               pure rules (no DOM): config (tolerant reader), profiles, classify (the one
                       rule that places every entity), appliances, floors, review, buildHouse,
                       names, paths
  summary.ts           the home headline
  strings.ts           every resident string
  actions/             light (by domain), colour, switch, action, scene, pending (3 s window),
                       undo (5 s), clipboard, dashboard-config (the review saves roles), haptic,
                       navigate
  theme/               CSS tokens (screens only) and the embedded Manrope font
  art/                 the 59 room drawings, the name/icon resolver, the render helper
  editing.ts           the edit mode (module state: it survives the view rebuild after a save)
  elements/            toggle tile (light, outlet, equipment), action button, appliance card and
                       panel, floor tabs, item editor, sheet, dimmer and colour panels, toast, nav bar, room card,
                       scene button
  screens/             home, room, scenes, review (each is a Lovelace card filling a panel view)
  cards/               standalone light card, error card
  strategy/            generateDashboard and the ll-strategy-dashboard-hubb element
  hubb-ha-ui.ts        entry: registers everything, injects the font
test/                  Vitest + happy-dom; helpers/fake-hass.ts; fixtures: sample-house (Kleber
                       shaped), clinic, casa-exemplo-2 (switch lights, washer), washer
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
- Dashboard URLs need a hyphen in Home Assistant (`hubb-casa`), so screens derive their base path
  from `location.pathname`.
- The `h.` glyph never appears in the panel.

## Release

CalVer `YYYY.M.R`. Close `[Unreleased]` in the CHANGELOG, bump `package.json`, tag
`vYYYY.M.R` (annotated), push the tag: CI builds and attaches `hubb-ha-ui.js` to the Release.
Never commit or push without Gustavo's explicit approval.

## Gotchas

- happy-dom has no layout: tests that need sizes mock `getBoundingClientRect`.
- `haptic` is a window event the Companion App turns into vibration; browsers ignore it.
- The undo offer lives in module state of `elements/toast.ts`, shared by every screen's toast, so it
  survives a view switch within its 5 s. Tests that show one withdraw it with `hide()`.
- Home Assistant stops sending `hass` to a hidden cached view. Undo reads the newest hass any screen
  got (module state in `screens/base.ts`), not the one of the screen that started the action.
- A tile keeps one timer, re-armed after every render from `PendingTracker.msUntilChange`; it also
  re-arms on reconnect, because a view switch disconnects the tile and drops the timer.
- HACS serves only `hubb-ha-ui.js`, which is why the font is inlined.
- `vite.config.ts` is outside `tsc` on purpose: it uses `node:fs` and would need `@types/node`.
- Room drawings go into the page through `unsafeSVG`. Only `src/art/drawings.ts` may feed it, and
  `test/art/drawings.test.ts` keeps that file to plain shapes with no colours, links or handlers.
  A new drawing also needs its words in `src/art/resolve.ts` and a row in `docs/drawings.md`.
- An outlet is a `switch` whose state attribute `device_class` is `outlet`: `hass.entities` does
  not carry the device class. Bulk actions and undo read `room.lights` only, on purpose.
- `src/model/classify.ts` is the one rule that decides where an entity goes. The panel, "Revisar o
  painel" and, later, the editor all call it; never place an entity anywhere else.
- `cachedStaticReview` keys on the identity of `hass.entities`, `hass.devices`, `hass.areas`,
  `hass.floors` and the configuration object: the frontend keeps those objects across state
  changes, so the home can count the review on every update.
