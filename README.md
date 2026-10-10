# Hubb HA UI

The Hubb dashboard for Home Assistant. A dashboard strategy builds the whole home screen from the
areas, devices and entities Home Assistant already knows, so every Hubb client runs the same code,
whatever the hardware behind the lights.

What the resident sees:

- **Home:** a greeting, one sentence about the house ("Sala com 2 luzes acesas."), the first four
  scenes and one card per room.
- **Room page:** the room photo, "Apagar tudo", the room scenes and one tile per light. Tap toggles;
  a long press on a dimmable light opens the brightness sheet (25, 50, 75, 100).
- **Scenes:** every scene, with the rooms it touches.
- **Undo** for 5 seconds after any bulk action, a dark (Ardósia) and a light (Areia) theme that
  follow the Home Assistant profile, and Manrope embedded in the file.

## Requirements

- Home Assistant **2026.5** or newer.
- HACS.

## Install

1. HACS, menu, **Custom repositories**: `https://github.com/self-labs/hubb-ha-ui`, category
   **Dashboard**. Download it.
2. **Settings > Dashboards > Add dashboard**, pick **Hubb** under Community dashboards (or create a
   blank one and paste the YAML below in the raw configuration editor). The URL needs a hyphen, for
   example `hubb-casa`.

```yaml
strategy:
  type: custom:hubb
  name: Casa Exemplo          # optional; default: the location name in Home Assistant
  scenes:                     # optional; order, the first four go to the home screen
    - scene.chegar
    - scene.sair
  rooms:                      # optional; by area_id
    sala:
      order: 1
      photo: /local/hubb/sala.jpg   # default: the picture of the area
      hidden: false
  hide_entities:              # optional
    - light.hubb_m2_saida_10
```

## What the installation must provide

- Every light in an **area**, with a short name ("Sofá", not "Saída 1"). Entities with no area are
  left out on purpose.
- Lights as `light.*` entities, whatever the board (ControlArt integration, KinCony with Tasmota
  `SetOption30 1`, or a template light).
- Scenes as `scene.*` or `script.*` with the label **`hubb_cena`**.
- An area **picture** for the room photo.

## Development

```bash
npm ci
npm run check      # typecheck, tests, build
```

The single artefact is `dist/hubb-ha-ui.js`. A `vYYYY.M.R` tag publishes it as a Release asset.

## License

MIT. Manrope, embedded in `hubb-ha-ui.js`, is under the SIL Open Font License 1.1: see
[`LICENSES/OFL-1.1-Manrope.txt`](LICENSES/OFL-1.1-Manrope.txt).

Not affiliated with, endorsed by or sponsored by Home Assistant or the Open Home Foundation.
