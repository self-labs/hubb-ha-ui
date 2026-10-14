[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5?logo=home-assistant&logoColor=white)](https://hacs.xyz/) [![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.5%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io/) [![Release](https://img.shields.io/github/v/release/self-labs/hubb-ha-ui?color=293a44)](https://github.com/self-labs/hubb-ha-ui/releases) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

# 🏠 Hubb HA UI

A home screen your clients actually enjoy opening. One dashboard strategy builds every screen of the
house from the areas Home Assistant already knows: a sentence about the house, one card per room, the
scenes, and lights that answer the moment they are touched.

There is no card YAML per client, and the same file runs on every house, whatever board drives the
lights.

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/home-dark.png" width="160" alt="Home screen, dark theme"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/home-light.png" width="160" alt="Home screen, light theme"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/room-dark.png" width="160" alt="Room page, dark theme"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/room-light.png" width="160" alt="Room page, light theme"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/sheet-dark.png" width="160" alt="Light sheet with colours, dark theme"></td>
  </tr>
  <tr>
    <td align="center">Home, Ardósia</td>
    <td align="center">Home, Areia</td>
    <td align="center">Room, Ardósia</td>
    <td align="center">Room, Areia</td>
    <td align="center">Light sheet</td>
  </tr>
</table>

## Why this exists

A polished Home Assistant dashboard is usually built by hand, and that is where it stops scaling:

| Approach                                       | Problem                                                                                  |
| :--------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Hand-built YAML (Mushroom, Bubble Card, ...)   | One copy per client: a fix has to be pasted into every house, one by one                 |
| Styling through `card-mod`                     | The premium look rides on CSS overrides that break when the frontend changes             |
| Entity ids written into the cards              | Swapping the relay board (ControlArt for KinCony, say) means rebuilding the dashboard     |
| Home Assistant's own area dashboard            | Generic look, every entity shown, nothing designed for the person living in the house    |

This takes a different route. A **dashboard strategy** (`custom:hubb`) reads the areas, devices and
entities at load time and generates the screens. The cards only receive entity ids, so the house is
described once, in Home Assistant itself, and one HACS update reaches every client.

## What the resident gets

| Screen          | What it shows                                                                                       |
| :-------------- | :-------------------------------------------------------------------------------------------------- |
| **Home**        | A greeting, the outside temperature, one sentence about the house, the first four scenes, the rooms |
| **Room page**   | The area photo or a drawing of the room, its temperature and humidity ("24° · 61%"), "Ocupado" and what is open, "Apagar tudo", the room's scenes, then its blocks: Acesso, Luzes, Clima, Cortinas, Mídia, Tomadas e equipamentos, Aparelhos, Ações |
| **Lights on**   | A sheet with every light that is on, grouped by room, and "Apagar todas"                            |
| **Scenes**      | Every scene, with the rooms it touches                                                              |
| **Segurança**   | The alarm, the doors and windows open now, every gate and lock, and the cameras. The tab shows only when the house has any of these |
| **Every screen** | A red strip for smoke, gas, carbon monoxide, a leak or the alarm going off, and a strip when the house is out of reach |

And the way it behaves:

| Interaction               | Behaviour                                                                                         |
| :------------------------ | :------------------------------------------------------------------------------------------------ |
| Tap a light               | Changes at once and vibrates; if Home Assistant does not confirm in 3 s, it says "Sem resposta"   |
| Tap a light that is down  | Says since when it stopped answering                                                               |
| Long press a dimmer       | Opens the light sheet: drag the column or pick 25, 50, 75 and 100; a colour light adds up to 9 colours, a white-temperature light adds its whites and a slider |
| Tap an outlet             | Switches it like a light; "Apagar tudo", "Apagar todas" and Desfazer never touch outlets          |
| Outlet with a power sensor | Says how much it draws ("Ligada · 120 W"); a long press opens Consumo: Agora and Hoje             |
| Arm or disarm the alarm   | Arming is a tap on Em casa, Ausente, Noite or Férias; disarming asks for the code, or takes a slide when the alarm has none |
| Tap a camera              | Opens the live view in Home Assistant's own window. The still image is taken once, when the tab opens |
| Alert strip               | Vibrates once, leads to the room; it stays while the sensor is on                                 |
| House out of reach        | "Sem conexão com a casa. Tentando de novo…"; the controls dim and take no tap until it is back    |
| Open a gate or a lock     | Slide to the end ("Deslize para abrir"); letting go earlier does nothing, and a tap never opens. Fechar and Trancar are a tap |
| Tap an air conditioner    | Opens its sheet: − and + for the temperature, the mode, the ventilation, the swing and the preset it has; the round button turns it on and off |
| Tap a fan                 | Switches it; a long press opens its speeds                                                         |
| Tap a curtain             | Opens or closes it, and stops it while it moves; a long press opens Abrir, Parar, Fechar and the position |
| Tap a TV or a speaker     | Opens its sheet: play and pause, the tracks, the volume, mute, the source, Ligar or Desligar        |
| Infrared device           | Its sheet says the state is the last command sent, not what the device reports                    |
| Bulk action or scene      | Runs at once and offers **Desfazer** for 5 s, even on another screen: the lights that changed go back, and a running script stops |
| Theme                     | Ardósia (dark) or Areia (light), following the Home Assistant profile, AA contrast in both         |
| Back                      | The in-app arrow and the Android back gesture stay in step                                         |
| Keyboard and readers      | A focus ring on every button; Escape closes the sheet; arrows, Page, Home and End set the brightness; right click or Shift+F10 opens the light sheet |

> [!NOTE]
> Vibration comes from the Home Assistant Companion App, which turns the frontend's `haptic` event
> into a buzz. A plain browser simply ignores it.

## Install

### HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=self-labs&repository=hubb-ha-ui&category=plugin)

The button opens this repository straight in your HACS. Click **Download**. No restart is needed:
HACS registers the dashboard resource by itself.

It works through [my.home-assistant.io](https://my.home-assistant.io/), which only knows how to reach
your instance after you set your own URL there once, under **Settings → System → Network → Home
Assistant URL**. Until then it asks for it.

<details>
<summary>Doing it by hand</summary>

1. HACS → three-dot menu → **Custom repositories**.
2. URL: `https://github.com/self-labs/hubb-ha-ui`, type **Dashboard** → **ADD**.
3. Open the entry and click **Download**.

</details>

<details>
<summary>Without HACS</summary>

1. Download `hubb-ha-ui.js` from the [latest release](https://github.com/self-labs/hubb-ha-ui/releases/latest)
   into `config/www/`.
2. **Settings → Dashboards → three-dot menu → Resources → Add resource**: URL
   `/local/hubb-ha-ui.js`, type **JavaScript module**.

</details>

## Create the dashboard

[![Open your Home Assistant instance and show your dashboards.](https://my.home-assistant.io/badges/lovelace_dashboards.svg)](https://my.home-assistant.io/redirect/lovelace_dashboards/)

1. **Add dashboard** and pick **Hubb** under *Community dashboards*.
2. Give it a URL with a hyphen, for example `hubb-casa` (Home Assistant requires the hyphen).
3. Open it. That is all; everything below is optional.

Or start from a blank dashboard and paste this into the raw configuration editor:

```yaml
strategy:
  type: custom:hubb
  name: Casa Exemplo
```

### Options

| Option                | Default                            | Meaning                                                    |
| :-------------------- | :--------------------------------- | :--------------------------------------------------------- |
| `name`                | The location name in Home Assistant | House name under the greeting                             |
| `scenes`              | Alphabetical                       | Scene order; the first four go to the home screen          |
| `rooms.<area>.order`  | Alphabetical                       | Room order                                                 |
| `rooms.<area>.photo`  | The area picture                   | Photo for the room card and the room page                  |
| `rooms.<area>.art`    | Picked from the area name, then its icon | Drawing for a room with no photo: one of the ids in [the list of drawings](docs/drawings.md) |
| `rooms.<area>.hidden` | `false`                            | Leaves a room out                                          |
| `rooms.<area>.floor`  | The floor of the area              | Moves a room to another floor without touching Home Assistant |
| `profile`             | `home`                             | Kind of place: `home`, `clinic`, `restaurant`, `office`, `store`, `gym`, `salon` or `hotel`. See [Places and floors](#places-and-floors) |
| `entities.<id>.role`  | From the entity type               | `light`, `outlet`, `equipment`, `appliance`, `action` or `hidden`. See [Roles](#roles) |
| `entities.<id>.name`  | The entity name                    | Name on the panel                                          |
| `entities.<id>.order` | By name                            | Place of the item inside its block, lower first            |
| `entities.<id>.icon`  | The icon of the role               | An `mdi:` icon for equipment and actions                   |
| `entities.<id>.area`  | The area of the entity, then of its device (an appliance: its device first) | Room of the entity on the panel |
| `entities.<id>.hide`  | none                               | Appliance only: entities of its device left out of its sheet |
| `entities.<id>.remaining`, `.progress` | Found on the device | Appliance only: the time left and the progress sensors, when the automatic pick is wrong |
| `hide_entities`       | none                               | Lights and outlets left out even though they have an area (the fridge or the router plug) |

```yaml
strategy:
  type: custom:hubb
  name: Casa Exemplo
  scenes: [scene.chegar, scene.sair, scene.noite, scene.cinema]
  rooms:
    sala_de_estar: { order: 1, photo: /local/hubb/sala.jpg }
    lavanderia: { hidden: true }
  hide_entities: [light.spot_da_garagem]
```

### Roles

Without a role, an entity reaches the panel by its type: `light.*` is a light, a `switch` shown as an
outlet is an outlet, a scene or script labelled `hubb_cena` is a scene, `climate` and `fan` go to
Clima, a `cover` goes to Cortinas (to Acesso when its class is gate, garage or door, or when it has no
class and its name says "portão"), a `lock` goes to Acesso and a `media_player` to Mídia (Browser Mod players stay out). A
role puts it somewhere else:

| Role        | Takes                                | Shows as                                                       |
| :---------- | :----------------------------------- | :------------------------------------------------------------- |
| `light`     | `light`, `switch`                    | A light, counted by "Apagar tudo", the home sentence and Desfazer |
| `outlet`    | `switch`                             | An outlet ("Ligada"/"Desligada")                               |
| `equipment` | `switch`                             | Equipment ("Ligado"/"Desligado"), with its `icon` or a power icon |
| `appliance` | any entity with a device             | The device becomes an appliance card, with a full sheet        |
| `action`    | `button`, `input_button`, `script`   | A button in "Ações" that says "Feito"                          |
| `gate`      | `switch`, `button`, `input_button`, `script`, `cover` | A gate in "Acesso", opened with a slide ("Deslize para acionar" for a pulse relay) |
| `hidden`    | anything                             | Left out                                                       |

```yaml
strategy:
  type: custom:hubb
  entities:
    switch.luz_varanda: { role: light }
    switch.bomba_piscina: { role: equipment, name: Bomba, icon: mdi:pool }
    switch.jet_mode: { role: hidden }
    switch.portao_social: { role: gate }
    button.reiniciar_roteador: { role: action }
    sensor.electrolux_lavadora_appliancestate:
      role: appliance
      hide: [button.electrolux_lavadora_executecommand_6]
```

A `switch` with no class and no role stays out of the panel and waits on **Revisar o painel**.

### Sensors, security and consumption

These need no role; their class says where they go:

| Entity | Shows as |
| :----- | :------- |
| `binary_sensor` `smoke`, `gas`, `carbon_monoxide`, `moisture` | The red strip on every screen, with or without a room |
| `binary_sensor` `door`, `window`, `garage_door`, `opening` | "Janela aberta" on the room, a chip on the home, and the security tab |
| `binary_sensor` `motion`, `occupancy`, `presence` with a room | "Ocupado" on the room and its card |
| `sensor` `temperature`, `humidity` with a room | "24° · 61%" under the room name; a dedicated thermometer wins over the one inside an air conditioner |
| `camera`, `alarm_control_panel` | The security tab, with or without a room |
| `sensor` `power`, `energy` on the device of an outlet or equipment | The power on its tile and the consumption sheet |

The class `problem` raises no alert: integrations use it for device faults. Only a sensor that reads
`on` counts: one that is down or unknown says nothing. A multi-channel device matches each switch to
the sensor with the same number at the end (`switch.x_1` with `sensor.x_power_1`); when its switches
were renamed, name the sensors:

```yaml
strategy:
  type: custom:hubb
  entities:
    switch.kitnet_banheiro: { power: sensor.sonoff_100155ace9_power_1, energy: sensor.sonoff_100155ace9_energy_1 }
```

"Hoje" reads the long-term statistics of the energy sensor, which every user of the dashboard may
read. The camera image is taken once each time the security tab opens, never refreshed while it
stays open, so a camera behind a tunnel does not eat its traffic; the live view runs only while its
window is open.

### Places and floors

`profile` names the first tab ("Casa" for a home, "Início" elsewhere) and picks the drawings: in a
`clinic` a "Sala 3" is drawn as a consulting room, in an `office` as an office, in a `hotel` a
"Quarto 12" as a hotel room. When the rooms sit on two or more floors of Home Assistant, the home
shows one floor at a time, with the lights on of each floor on its button; the floor picked last is
remembered on the phone.

### Appliances

Give the `appliance` role to one entity of a washer, a dryer or a dishwasher (its state sensor is the
natural pick). Its device becomes a card in the room ("Lavando · faltam 40 min"); while it works, a
"Lavadora · 40 min" button shows on the home. Its sheet shows how long is left, the commands that make
sense now, the program and level choices and the options; an option the program does not take
disappears. Made with the [Electrolux integration](https://github.com/albaintor/homeassistant_electrolux_status)
in mind, it reads any device that exposes its state, buttons, `select` and `switch` entities.

When the device also has a connection sensor and a remote control sensor (Electrolux
`connectivityState` and `remoteControl`), the card says "Sem conexão" or "Controle remoto desligado"
and the sheet greys out the commands, with the reason. Only `Enabled` takes commands, the same rule
Electrolux publishes for its appliances. A command that fails shows one line on the sheet instead of
the toast of Home Assistant; administrators also read when the integration lost its access to the
maker's cloud.

### Review the panel

Administrators get a wrench at the top of the home. It opens **Revisar o painel**: the switches with no
role, the appliances found, what has no room, the problems of the configuration and what has not
answered for more than a day. A tap on a role saves it into the dashboard configuration, the same
`entities:` keys as above, and Home Assistant rebuilds the panel at once; "Desfazer" takes it back
for 5 seconds. "Aplicar sugestões" saves every suggested role together. On a dashboard frozen with
"Take control" it copies the line of YAML instead, to paste under `strategy:` by hand.

### Edit the panel

Administrators also get a pencil, on the home and on each room page. In the edit mode:

- **On the home:** arrows under each room card change the order of the rooms, and **Esconder** takes a
  room off the home; the hidden rooms are listed at the bottom with **Mostrar**.
- **On a room page:** a tap on an item opens its editor: the name on the panel, its room, how it shows
  (Luz, Tomada, Equipamento, Aparelho, Ação, Portão or Não mostrar; an air conditioner, a fan, a
  curtain, a TV or a lock shows by its type and offers Não mostrar, and a curtain can become a
  Portão) and its place in its block. What the
  configuration hides in that room is listed with **Mostrar**.

Every change is saved into the dashboard configuration (the same keys as the YAML above, plus
`entities.<id>.order` for the place of an item) and Home Assistant rebuilds the panel at once;
"Desfazer" takes it back for 5 seconds. A dashboard frozen with "Take control" shows no pencil.

## Prepare the house

The strategy shows what Home Assistant knows, so the work happens in Home Assistant, once per house:

| What                      | Why                                                       | How                                                                                                   |
| :------------------------ | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **Every light in an area** | A light with no area is left out on purpose              | Settings → Areas, labels & zones, or the area field of each entity                                    |
| **Lights as `light.*`**   | Relays exposed as switches or helpers are not lights      | A switch that is a light: entity settings, **Show as** Light. ControlArt: the [ControlArt integration](https://github.com/tompsonpecini/controlart). KinCony with Tasmota: `SetOption30 1`. Anything else: a template light |
| **Outlets as outlets**    | Only a switch shown as an outlet reaches the panel on its own | Entity settings, **Show as** Outlet, or a [role](#roles). Any other switch waits on **Revisar o painel** |
| **Short, client names**   | The tile shows the name as is                             | "Sofá", not "Saída 1". A room name at the start or the end is dropped ("LED Sala" in the Sala shows "LED") |
| **Scenes labelled**       | Only labelled scenes and scripts reach the panel          | Label **`hubb_cena`** on a `scene.*` or `script.*`; give it an area to show it on that room too       |
| **Area pictures** (optional) | Without one, the card shows a drawing picked from the area name or icon ([list](docs/drawings.md)) | The picture field of each area                                                  |

Hidden and diagnostic entities never show up on their own (an appliance still reads its diagnostic
time left), and neither does anything without an area, which is why the per-browser screen lights
that Browser Mod creates stay out by themselves.

## Compatibility

Requires **Home Assistant 2026.5 or newer**, the release that lists community strategies in the *Add
dashboard* dialog. Strategies themselves are an official frontend extension point since 2021.5, and
the registries the panel reads (`hass.areas`, `hass.devices`, `hass.entities` with labels) are open to
non-admin users, so residents never need admin rights.

## Responsible use

The panel runs on Home Assistant and does not hide it. Tell the client what runs underneath, keep
Home Assistant named in your proposal and handover, and never imply an affiliation with the Open Home
Foundation. To put your own mark on the login screen and the app icon, see
[ha-custom-branding](https://github.com/self-labs/ha-custom-branding), which also explains the
trademark side in detail.

## Development

```bash
npm ci
npm run check      # typecheck, tests, build
```

The single artefact is `dist/hubb-ha-ui.js`. A `vYYYY.M.R` tag publishes it as a Release asset.
Conventions for contributors and agents live in [CLAUDE.md](./CLAUDE.md).

## License

MIT. See [LICENSE](./LICENSE). Manrope, embedded in `hubb-ha-ui.js`, is under the SIL Open Font
License 1.1: see [`LICENSES/OFL-1.1-Manrope.txt`](LICENSES/OFL-1.1-Manrope.txt).

Not affiliated with, endorsed by or sponsored by Home Assistant or the Open Home Foundation.
