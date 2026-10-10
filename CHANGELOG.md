# Changelog

All notable changes to Hubb HA UI are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versions follow **CalVer `YYYY.M.R`** (year, month with no leading zero, revision within the month),
**not** Semantic Versioning.

## [Unreleased]

### Changed

- README rewritten in the house layout: badges, screenshots of the sample house in both themes,
  one-click buttons to open the repository in HACS and the dashboards page, the options table and
  what each house must provide. The screenshots also satisfy the HACS "images" check.

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

[Unreleased]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.2...HEAD
[2026.10.2]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.1...v2026.10.2
[2026.10.1]: https://github.com/self-labs/hubb-ha-ui/releases/tag/v2026.10.1
