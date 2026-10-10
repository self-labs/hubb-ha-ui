# Changelog

All notable changes to Hubb HA UI are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versions follow **CalVer `YYYY.M.R`** (year, month with no leading zero, revision within the month),
**not** Semantic Versioning.

## [Unreleased]

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

[Unreleased]: https://github.com/self-labs/hubb-ha-ui/commits/master
