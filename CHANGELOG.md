# Changelog

All notable changes to Hubb HA UI are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versions follow **CalVer `YYYY.M.R`** (year, month with no leading zero, revision within the month),
**not** Semantic Versioning.

## [Unreleased]

## [2026.10.3] - 2026-10-12

### Added

- Room drawings. A room with no photo shows a line drawing on the right of its card and of its
  header, picked from the area name (59 kinds of room for homes, clinics, restaurants, offices,
  shops and hotels) or else from the area icon. The lamp in the drawing lights up in amber while
  the room has a light on. `rooms.<area>.art` picks a drawing by hand.
- A colour light that is on paints its tile icon with its current colour; whites keep the amber
  look.
- The light sheet offers 9 colours (three whites, amber, red, pink, purple, blue and green) and a
  white-temperature slider, each only when the light supports it. A colour light with a white
  channel and no colour temperature gets a single "Branco".
- Outlets. A switch shown as Outlet in Home Assistant gets an on and off tile under "Tomadas e
  equipamentos" on its room page, and a room with only outlets now appears. "Apagar tudo",
  "Apagar todas" and Desfazer never touch outlets.

### Changed

- README rewritten in the house layout: badges, screenshots of the sample house in both themes,
  one-click buttons to open the repository in HACS and the dashboards page, the options table and
  what each house must provide. The screenshots also satisfy the HACS "images" check.
- The home sentence for a single lit room ends with "O resto está apagado.", which fits a clinic,
  a shop or an office as well as a house.
- README: drawings, colours and outlets in the feature tables, `rooms.<area>.art`, Show as Light
  and Show as Outlet in the preparation table, and new screenshots including the light sheet. The
  screenshots use absolute URLs, because HACS rewrites only markdown links and showed the relative
  ones broken. `docs/drawings.md` lists the 59 drawings with their ids and the words that pick them.
- Areia: the secondary text is darker (`#58646c`) and the icon of a lit tile is dark on the amber,
  so both pass AA contrast. The first Areia grey (`#6e7a82`) failed it on every light surface, and
  white on the amber was 2.2:1.

### Fixed

- A late confirmation ends "Sem resposta" at once, instead of four seconds later.
- A second tap that races the first no longer passes for done on the old state: the tile waits for
  a new answer, and says "Sem resposta" if none comes.
- A tile taken off the page and put back (a view switch) keeps its clock, so "Acendendo…" ends when
  the time is up instead of waiting for the next state, and it does not replay or vibrate for a
  tap made long before.
- Desfazer:
  - always puts back the lights the action set ("Apagar tudo", "Apagar todas", the lights a scene
    lists, on the panel or not), even the ones whose change has not arrived yet;
  - after a script, which does not say what it sets, puts back what changed and stops the script
    first;
  - waits for the action at most 2.5 s;
  - stays on offer when an action fails after some lights changed, and a failure only withdraws
    its own offer;
  - vibrates when putting back fails;
  - survives moving to another screen within its five seconds, and reads the newest state there.
- Keyboard and screen readers: a focus ring on every button, in a colour that stands out on every
  surface of both themes; the light sheet takes the focus and closes on Escape; the brightness
  column answers the arrow, Page, Home and End keys, and a held key sends one call; the light sheet
  also opens from the context menu (right click, Shift+F10); the undo message is announced.
- On a white-temperature light with a narrow range, the white buttons that remain are the ones
  whose names match what the light shows.
- The home chip is 44 px tall, like every other touch target.
- The standalone light card opens its own light sheet on a long press, as the card picker says,
  and the picker pre-fills the first light of the house.
- The HACS validation runs on every release; a Release made by the workflow never triggered it.

## [2026.10.2] - 2026-10-10

### Changed

- The room page opens with a compact header: back arrow, room name and status on one row, and
  the tall hero only when the area has a photo.

### Fixed

- Content started too far from the top on phones: the screens added the status-bar safe area on
  top of Home Assistant's own.
- Turning a light on no longer pushes the cards down: the room keeps the "Apagar tudo" slot, and
  the home keeps room for the chip row and a two-line headline.
- Room cards in Areia (light theme) no longer get a dark gradient behind dark text; the scrim now
  appears only over an area photo, and light cards get a soft edge instead.

## [2026.10.1] - 2026-10-10

### Added

- Dashboard strategy `custom:hubb` that builds the home, room and scenes screens from Home
  Assistant areas, with no card YAML per client.
- Light tiles that answer on tap, wait 3 s for Home Assistant to confirm and say "Sem resposta"
  otherwise, with a success or failure vibration; tapping a light that stopped answering says
  since when. A long press on a dimmable light opens a brightness sheet with 25, 50, 75 and 100
  that holds the chosen level until Home Assistant confirms it; a slow press on an on/off light
  still toggles it.
- The in-app back arrow and the bottom tabs keep the browser history in step, so the Android back
  gesture goes where the resident expects.
- Undo for 5 s after turning a room off, turning every light off or running a scene.
- Ardósia (dark) and Areia (light) themes following the Home Assistant profile, with text that
  meets WCAG AA in both, and Manrope embedded in the single `hubb-ha-ui.js` (its SIL Open Font
  License ships in `LICENSES/`).
- Standalone `custom:hubb-light-card` for dashboards built by hand.
- CI on every push, and a Release with `hubb-ha-ui.js` attached on every version tag.

[Unreleased]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.3...HEAD
[2026.10.3]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.2...v2026.10.3
[2026.10.2]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.1...v2026.10.2
[2026.10.1]: https://github.com/self-labs/hubb-ha-ui/releases/tag/v2026.10.1
