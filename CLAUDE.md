# Hubb HA UI: Repository Conventions (for AI agents)

A Home Assistant **frontend plugin**, distributed through HACS (category Dashboard): a dashboard
strategy (`custom:hubb`) plus Lit cards that build the Hubb home screens from the areas, devices and
entities Home Assistant already knows. One code base for every Hubb client, whatever the hardware
(ControlArt relay and dimmer, KinCony relay and IR).

Design spec: `homeassistant` repo, `docs/superpowers/specs/2026-10-09-hubb-ha-ui-design.md`.

## Language

- Code, comments, README, CHANGELOG, commit messages: **English**.
- Resident-facing strings: **Brazilian Portuguese with full accents**, all in `src/strings.ts`,
  gender-neutral (room names come from the client).
- **Never use em dashes or en dashes** anywhere.

## Layout

```text
src/
  ha/types.ts          the slice of the frontend `hass` object we read
  model/               pure rules: buildHouse, names, paths (no DOM)
  summary.ts           the home headline
  strings.ts           every resident string
  actions/             light, scene, pending (3 s window), undo (5 s), haptic, navigate
  theme/               CSS tokens (screens only) and the embedded Manrope font
  elements/            light tile, sheet, dimmer panel, toast, nav bar, room card, scene button
  screens/             home, room, scenes (each is a Lovelace card filling a panel view)
  cards/               standalone light card, error card
  strategy/            generateDashboard and the ll-strategy-dashboard-hubb element
  hubb-ha-ui.ts        entry: registers everything, injects the font
test/                  Vitest + happy-dom; helpers/fake-hass.ts, fixtures/sample-house.ts
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
- HACS serves only `hubb-ha-ui.js`, which is why the font is inlined.
- `vite.config.ts` is outside `tsc` on purpose: it uses `node:fs` and would need `@types/node`.
