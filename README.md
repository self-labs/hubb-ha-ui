[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5?logo=home-assistant&logoColor=white)](https://hacs.xyz/) [![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.5%2B-41BDF5?logo=home-assistant&logoColor=white)](https://www.home-assistant.io/) [![Release](https://img.shields.io/github/v/release/self-labs/hubb-ha-ui?color=293a44)](https://github.com/self-labs/hubb-ha-ui/releases) [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

# 🏠 Hubb HA UI

The panel a resident opens on the phone, built by Home Assistant itself. One dashboard strategy reads
the areas, devices and entities of the house and draws every screen: a sentence about the house, one
card per room, the lights, the air conditioning, the curtains, the TV, the gate, the washer, the alarm
and the cameras. There is no card YAML per client: the same file runs on every house, whatever board
drives the relays, and one HACS update reaches them all.

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/home-dark.png" width="220" alt="Home screen: greeting, a sentence about the house, chips for the lights on, the washer and an open window, the scenes and the rooms"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/room-dark.png" width="220" alt="Living room page: lights, air conditioner, curtain and TV"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/security-dark.png" width="220" alt="Security tab: alarm with a slide to disarm, an open window, the gate and the lock, two cameras"></td>
  </tr>
  <tr>
    <td align="center"><b>Home</b><br>the house in one sentence</td>
    <td align="center"><b>Room</b><br>everything in it, in blocks</td>
    <td align="center"><b>Segurança</b><br>alarm, doors, gate, cameras</td>
  </tr>
</table>

> [!NOTE]
> Every screenshot here comes from `npm run preview`, a made-up house drawn by the real bundle (see
> [Development](#development)). The panel speaks Brazilian Portuguese: it is made for Hubb's clients.

## Why this exists

A polished Home Assistant dashboard is usually built by hand, and that is where it stops scaling:

| Approach                                     | Problem                                                                               |
| :------------------------------------------- | :------------------------------------------------------------------------------------ |
| Hand-built YAML (Mushroom, Bubble Card, ...) | One copy per client: a fix has to be pasted into every house, one by one              |
| Styling through `card-mod`                   | The premium look rides on CSS overrides that break when the frontend changes          |
| Entity ids written into the cards            | Swapping the relay board (ControlArt for KinCony, say) means rebuilding the dashboard |
| Home Assistant's own area dashboard          | Generic look, every entity shown, nothing designed for the person living in the house |

This takes a different route. A **dashboard strategy** (`custom:hubb`) reads the areas, devices and
entities at load time and generates the screens. The cards only receive entity ids, so the house is
described once, in Home Assistant itself, and one HACS update reaches every client.

## A tour of the panel

### Home

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/home-light.png" width="200" alt="Home screen in the light theme"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/alert-light.png" width="200" alt="Home screen with the red strip for smoke in the kitchen"></td>
  </tr>
  <tr>
    <td align="center">Areia, the light theme</td>
    <td align="center">An alert on every screen</td>
  </tr>
</table>

- A greeting with the resident's name, the outside temperature and **one calm sentence about the
  house** ("4 luzes acesas em 3 ambientes."); it names the rooms only while they are two.
- Chips for what needs attention: the lights on (a tap lists them and turns them all off), an
  appliance running ("Lavadora · 40 min"), a window left open ("Janela aberta · Quarto", with the
  icon of a window, so it reads as a sensor).
- The first four scenes, then one card per room with its photo or one of [59 drawings](docs/drawings.md),
  lit while a light is on, with "Ocupado" when someone is in.
- **Smoke, gas, carbon monoxide, a leak or the alarm going off** turn into a red strip on top of every
  screen. It vibrates once, leads to the room and stays while the sensor is on. When the house is out
  of reach, a grey strip says so and the controls dim.
- Ardósia (dark) or Areia (light), following the Home Assistant profile, with AA contrast in both.

### Room page

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/room-light.png" width="200" alt="Bedroom page with the lights, the air conditioner and the Sensores block: window open, someone in, temperature and humidity"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/sheet-dark.png" width="200" alt="Light sheet with brightness, colours and white temperature"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/climate-dark.png" width="200" alt="Compact air conditioner sheet: temperature, power, the modes and Mais ajustes"></td>
  </tr>
  <tr>
    <td align="center">Sensors of the room</td>
    <td align="center">Light sheet</td>
    <td align="center">Air conditioner</td>
  </tr>
</table>

- The header reads the room: how many lights are on, and **"24° · 61%"** from its thermometer.
- **Apagar tudo** and the room's scenes, then the blocks in a fixed order: Acesso, Luzes, Clima,
  Cortinas, Mídia, Tomadas e equipamentos, Aparelhos, Ações, Sensores. A block with nothing stays out.
- **Sensores:** one card per sensor of the room, with its icon and what it reads (a window "Aberta",
  presence "Ocupado", "24,4°", "61%"); a tap opens its history in Home Assistant. A contact that is
  the sensor of a gate in the same room shows there only in edit mode: the card of the gate says it.
- **Lights** change at once and vibrate; with no answer in 3 s they say "Sem resposta". A long press
  opens the sheet: brightness, 9 colours, the whites and their temperature, each only when the bulb
  has it.
- **Air conditioner:** what it is doing, the target and the temperature now. Its sheet is compact:
  − and + with the power button, the modes in one row, and ventilation, swing and preset closed under
  **Mais ajustes**, together with the functions its device keeps in entities of its own (Iluminação,
  Economia de energia, Modo dormir, the timers to turn on and off): each model shows what it has. A
  value no one translated ("MiddleTop1") stays out, and the installer picks which modes, settings and
  functions show. The target moves by whole degrees, like a remote control. An infrared one says its
  state is the last command sent.
- **Curtains** open, close and stop with a tap; **fans** switch and open their speeds.
- **TV and sound:** the card shows the cover of what plays (the icon when there is none), bars that
  move while it plays, and the song, which scrolls to its end and back when it is longer than the
  card; it plays, pauses and turns off. The sheet has the cover, the title and
  the artist, the time of the song (drag it when the player can seek), repeat, previous, play, next
  and shuffle in five fixed places, the volume (quick taps add up and leave as one command) with a
  bar, the source, the sound mode, the **Canal** (stereo, left or right) when the speaker's
  integration has a select for it, and **Tocar junto**.
- **Spotify** is never a card of its own: while it plays on a speaker of the panel (its source has
  the speaker's name), that speaker's card and sheet show the music and send play, pause and the
  tracks to it.
- **Tocar junto** lists the other speakers the resident sees, of the same integration, each with a
  switch: Home Assistant groups them (`media_player.join` and `unjoin`), and the card of a grouped
  speaker shows a group mark that says who it plays with. A speaker in someone else's group plays the
  leader's music and commands, offers no source (it would leave the group) and only Sair do grupo;
  the leader adds Volume de todas, one step on each speaker, the **Canal** of each speaker of the
  group and, with two speakers, **Formar par estéreo** (left on the leader, right on the other). A
  speaker that ends up alone goes back to stereo.
- WiiM adds a "Group Master" player to every speaker and shows it while that speaker leads a group;
  the panel leaves it out, since it repeats the leader.

### Access and security

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/access-light.png" width="200" alt="Entrance page with the lock and the gate, each with a slide to open"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/security-dark.png" width="200" alt="Security tab"></td>
  </tr>
  <tr>
    <td align="center">Slide to open</td>
    <td align="center">The Segurança tab</td>
  </tr>
</table>

- **A gate, a door or a lock never opens with a tap.** It takes a slide to the end ("Deslize para
  abrir"); letting go earlier, a second finger or the phone taking the touch away does nothing.
  Closing and locking are a tap.
- **A gate on a pulse relay can have a sensor** (a door contact or a gate cover). Its card then says
  Aberto or Fechado, opens with the slide, closes with a tap on Fechar, and says Abrindo… or
  Fechando… until the sensor moves (90 s at most). While the card waits after a pulse, while a cover
  used as the sensor says the gate is moving, or while the sensor does not answer, it goes back to
  "Deslize para acionar", which never promises a direction. Every card of the gate on the phone waits
  with it, and every phone reads the pulse on the relay itself (the press of a button, the run of a
  script, the last change of a switch). A pulse from the remote control cannot be seen, and a contact
  reads Aberto on a gate stopped halfway: on a controller that turns back after a stop, Fechar then
  opens it. Check that the card says Aberto with the gate open before relying on Fechar.
- The **Segurança** tab gathers the alarm (arming is a tap; disarming asks for the code, or takes a
  slide when there is none), the doors and windows open now (as cards, and "Sem resposta" for one that
  does not answer: never an all-clear by default), every gate and lock of the house (a cover used as
  the sensor of a gate stays out), and the cameras.
- **Cameras:** one still image each time the tab opens, never refreshed while it stays open, so a
  camera behind a tunnel does not eat its traffic. A tap opens the live view in Home Assistant's own
  window.

### Appliances and consumption

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/appliance-dark.png" width="200" alt="Washer sheet with the time left, the commands, the program and the options"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/power-light.png" width="200" alt="Consumption sheet of an outlet: power now and energy today"></td>
  </tr>
  <tr>
    <td align="center">Washer</td>
    <td align="center">Consumption</td>
  </tr>
</table>

- A **washer, dryer or dishwasher** becomes one card ("Lavando · faltam 40 min") and a timer chip on
  the home. Its sheet has the time left, the commands that make sense now, the program, the level and
  the options; it greys the commands out when the appliance is offline or its remote control is off.
- An **outlet with a power sensor** says how much it draws ("Ligada · 120 W"); a long press opens
  Consumo with **Agora** and **Hoje**.

### For the installer

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/review-light.png" width="200" alt="Revisar o painel: switches waiting for a role and a light with no room"></td>
    <td><img src="https://raw.githubusercontent.com/self-labs/hubb-ha-ui/master/docs/images/edit-dark.png" width="200" alt="Edit mode on a room page: every item says what it is and the integration it comes from"></td>
  </tr>
  <tr>
    <td align="center">Revisar o painel</td>
    <td align="center">Edit mode</td>
  </tr>
</table>

- **Revisar o painel** (the wrench, administrators only) lists what the panel cannot place by itself:
  switches with no role, **items with the same name in the same room** (one device seen by two
  integrations, with where each comes from), appliances found, what has no room (with a **Cômodo**
  list that puts that one entity in an area), mistakes in the configuration and what has not
  answered for a day. One tap saves the choice; "Aceitar todas as
  sugestões" saves them all.
- **Edit mode** (the pencil): every item says what it is and **the integration it comes from**
  ("Ar-condicionado · LG ThinQ"); its editor adds the entity id and the name Home Assistant gives it.
  Rename an item, move it to another room, change how it shows, reorder it, pick how wide its card
  is (**Pequeno**, **Médio** or **Grande**: a third, half or the whole row; a scene of Cenas too),
  hide a room or a sensor, pick the modes of an air conditioner. Every change goes into the
  dashboard configuration with **Desfazer** for 5 s.
- **Who sees what:** a room or an item can be hidden for chosen users (**Quem vê**), see
  [Who sees what](#who-sees-what).
- Residents never see either: client accounts are not administrators.

<details>
<summary>Every interaction, in detail</summary>

| Interaction                | Behaviour                                                                                                                                                      |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap a light                | Changes at once and vibrates; if Home Assistant does not confirm in 3 s, it says "Sem resposta"                                                                |
| Tap a light that is down   | Says since when it stopped answering                                                                                                                           |
| Long press a dimmer        | Opens the light sheet: drag the column or pick 25, 50, 75 and 100; a colour light adds up to 9 colours, a white-temperature light adds its whites and a slider |
| Tap an outlet              | Switches it like a light; "Apagar tudo", "Apagar todas" and Desfazer never touch outlets                                                                       |
| Outlet with a power sensor | Says how much it draws ("Ligada · 120 W"); a long press opens Consumo: Agora and Hoje                                                                          |
| Arm or disarm the alarm    | Arming is a tap on Em casa, Ausente, Noite or Férias; disarming asks for the code, or takes a slide when the alarm has none                                    |
| Tap a camera               | Opens the live view in Home Assistant's own window. The still image is taken once, when the tab opens                                                          |
| Alert strip                | Vibrates once, leads to the room; it stays while the sensor is on                                                                                              |
| House out of reach         | "Sem conexão com a casa. Tentando de novo…"; the controls dim and take no tap until it is back                                                                 |
| Open a gate or a lock      | Slide to the end ("Deslize para abrir"); letting go earlier does nothing, and a tap never opens. Fechar and Trancar are a tap                                  |
| Tap an air conditioner     | Opens its sheet: − and + for the temperature, the mode, the ventilation, the swing and the preset it has; the round button turns it on and off                 |
| Tap a fan                  | Switches it; a long press opens its speeds                                                                                                                     |
| Tap a curtain              | Opens or closes it, and stops it while it moves; a long press opens Abrir, Parar, Fechar and the position                                                      |
| Tap a TV or a speaker      | Opens its sheet: cover, time, the controls, volume, source, sound mode, channel, Tocar junto, Ligar or Desligar                                               |
| Infrared device            | Its sheet says the state is the last command sent, not what the device reports                                                                                 |
| Bulk action or scene       | Runs at once and offers **Desfazer** for 5 s, even on another screen: the lights that changed go back, and a running script stops                              |
| Back                       | The in-app arrow and the Android back gesture stay in step                                                                                                     |
| Keyboard and readers       | A focus ring on every button; Escape closes the sheet; arrows, Page, Home and End set the brightness; right click or Shift+F10 opens the light sheet           |

</details>

> [!NOTE]
> Vibration comes from the Home Assistant Companion App, which turns the frontend's `haptic` event
> into a buzz. A plain browser simply ignores it.

## Install

### HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=self-labs&repository=hubb-ha-ui&category=plugin)

The button opens this repository straight in your HACS. Click **Download**. No restart is needed:
HACS registers the dashboard resource by itself.

It works through [my.home-assistant.io](https://my.home-assistant.io/). The first time, it asks for
the address of your Home Assistant (for example `http://192.168.1.10:8123`) and keeps it in that
browser, not in Home Assistant: another browser or computer asks again, and the network settings of
Home Assistant play no part. To change the saved address, open
[my.home-assistant.io/redirect/\_change](https://my.home-assistant.io/redirect/_change/).

**For the residents, also install [kiosk-mode](https://github.com/NemesisRE/kiosk-mode)** from HACS
(Frontend). The panel asks it to hide the header and the sidebar of Home Assistant for every user who
is not an administrator, so a resident sees the panel alone; administrators keep both, for the pencil
and the settings. Nothing to configure: without kiosk-mode the panel works the same, with the menus
of Home Assistant around it. A resident then has no "Configurações do aplicativo" or "Notificações"
in the Companion app: set up notifications and location on their phone before.

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

1. **Add dashboard** and pick **Hubb** under _Community dashboards_.
2. Give it a URL with a hyphen, for example `hubb-casa` (Home Assistant requires the hyphen).
3. Make it everyone's default: back on **Settings → Dashboards**, the three-dot menu on its row →
   **Set as default**. Every user then opens Home Assistant on the panel, in the Companion app and
   in any browser, which matters once kiosk-mode hides the sidebar. Home Assistant keeps this on the
   server since 2025.12. Someone who picked a dashboard in their own profile keeps it until they set
   it back to **Auto (use system settings)**, and an admin-only dashboard cannot be the default.
4. Open it. That is all; everything below is optional.

Or start from a blank dashboard and paste this into the raw configuration editor:

```yaml
strategy:
  type: custom:hubb
  name: Casa Exemplo
```

### Options

| Option                                               | Default                                                                     | Meaning                                                                                                                                                                                                                                                                                                                                                                                                         |
| :--------------------------------------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                               | The location name in Home Assistant                                         | House name under the greeting                                                                                                                                                                                                                                                                                                                                                                                   |
| `scenes`                                             | Alphabetical                                                                | Scene order; the first four go to the home screen                                                                                                                                                                                                                                                                                                                                                               |
| `rooms.<area>.order`                                 | Alphabetical                                                                | Room order                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rooms.<area>.photo`                                 | The area picture                                                            | Photo for the room card and the room page                                                                                                                                                                                                                                                                                                                                                                       |
| `rooms.<area>.art`                                   | Picked from the area name, then its icon                                    | Drawing for a room with no photo: one of the ids in [the list of drawings](docs/drawings.md)                                                                                                                                                                                                                                                                                                                    |
| `rooms.<area>.hidden`                                | `false`                                                                     | Leaves a room out                                                                                                                                                                                                                                                                                                                                                                                               |
| `rooms.<area>.floor`                                 | The floor of the area                                                       | Moves a room to another floor without touching Home Assistant                                                                                                                                                                                                                                                                                                                                                   |
| `profile`                                            | `home`                                                                      | Kind of place: `home`, `clinic`, `restaurant`, `office`, `store`, `gym`, `salon` or `hotel`. See [Places and floors](#places-and-floors)                                                                                                                                                                                                                                                                        |
| `entities.<id>.role`                                 | From the entity type                                                        | `light`, `outlet`, `equipment`, `appliance`, `action`, `gate` or `hidden`. See [Roles](#roles)                                                                                                                                                                                                                                                                                                                  |
| `entities.<id>.name`                                 | The entity name                                                             | Name on the panel                                                                                                                                                                                                                                                                                                                                                                                               |
| `entities.<id>.order`                                | By name                                                                     | Place of the item inside its block, lower first                                                                                                                                                                                                                                                                                                                                                                 |
| `entities.<id>.icon`                                 | The icon of the role                                                        | An `mdi:` icon for equipment and actions                                                                                                                                                                                                                                                                                                                                                                        |
| `entities.<id>.area`                                 | The area of the entity, then of its device (an appliance: its device first) | Room of the entity on the panel                                                                                                                                                                                                                                                                                                                                                                                 |
| `entities.<id>.hide`                                 | none                                                                        | Appliance or air conditioner: entities of its device left out of its sheet                                                                                                                                                                                                                                                                                                                                      |
| `rooms.<area>.hidden_for`                            | none                                                                        | User ids of Home Assistant the room is hidden for (not administrators). See [Who sees what](#who-sees-what)                                                                                                                                                                                                                                                                                                     |
| `entities.<id>.hidden_for`                           | none                                                                        | User ids the item is hidden for; danger alerts still show                                                                                                                                                                                                                                                                                                                                                       |
| `entities.<id>.size`                                 | Tiles `small`, scenes of Cenas `medium`                                     | How wide the card is: `small` (a third of the row), `medium` (half) or `large` (all of it). Air conditioners, TVs, gates, locks and appliances always take the whole row                                                                                                                                                                                                                                        |
| `entities.<id>.sensor`                               | none                                                                        | A gate on a pulse relay (`role: gate` on a `switch`, `button`, `input_button` or `script`): the `binary_sensor` of class `door`, `garage_door` or `opening`, or the gate `cover`, that says whether it is open, from any room (the editor offers those of the gate's room). A contact of the gate's room shows in Sensores only in edit mode and still counts as open; a cover used as the sensor leaves Acesso |
| `tabs.scenes.hidden_for`, `tabs.security.hidden_for` | none                                                                        | User ids Cenas or Segurança is hidden for. See [Who sees what](#who-sees-what)                                                                                                                                                                                                                                                                                                                                  |
| `entities.<id>.remaining`, `.progress`               | Found on the device                                                         | Appliance only: the time left and the progress sensors, when the automatic pick is wrong                                                                                                                                                                                                                                                                                                                        |
| `entities.<id>.power`, `.energy`                     | Found on the device                                                         | Outlet or equipment: its power and energy sensors, when the automatic match fails. See [Sensors, security and consumption](#sensors-security-and-consumption)                                                                                                                                                                                                                                                   |
| `entities.<id>.modes`                                | Every mode it has                                                           | Air conditioner (`climate.*`) only: the modes its sheet offers, for example `[cool, dry]`; turning on without `turn_on` picks among them                                                                                                                                                                                                                                                                        |
| `entities.<id>.controls`                             | Every setting it has                                                        | Air conditioner (`climate.*`) only: which of `fan`, `swing` and `preset` show under Mais ajustes, as a list (`[fan, swing]`)                                                                                                                                                                                                                                                                                    |
| `hide_entities`                                      | none                                                                        | Lights and outlets left out even though they have an area (the fridge or the router plug)                                                                                                                                                                                                                                                                                                                       |

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
class and its name says "portão"; out of the panel when it is the `sensor` of a gate), a `lock` goes to Acesso and a `media_player` to Mídia (Browser Mod and Spotify players stay out). A
role puts it somewhere else:

| Role        | Takes                                                 | Shows as                                                                                                                                   |
| :---------- | :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `light`     | `light`, `switch`                                     | A light, counted by "Apagar tudo", the home sentence and Desfazer                                                                          |
| `outlet`    | `switch`                                              | An outlet ("Ligada"/"Desligada")                                                                                                           |
| `equipment` | `switch`                                              | Equipment ("Ligado"/"Desligado"), with its `icon` or a power icon                                                                          |
| `appliance` | any entity with a device                              | The device becomes an appliance card, with a full sheet                                                                                    |
| `action`    | `button`, `input_button`, `script`                    | A button in "Ações" that says "Feito"                                                                                                      |
| `gate`      | `switch`, `button`, `input_button`, `script`, `cover` | A gate in "Acesso", opened with a slide ("Deslize para acionar" for a pulse relay; with a `sensor`, Aberto or Fechado and a Fechar button) |
| `scene`     | `scene`, `script`                                     | A scene in Cenas, with or without a room, like one labelled `hubb_cena`                                                                    |
| `hidden`    | anything                                              | Left out                                                                                                                                   |

```yaml
strategy:
  type: custom:hubb
  entities:
    switch.luz_varanda: { role: light }
    switch.bomba_piscina: { role: equipment, name: Bomba, icon: mdi:pool }
    switch.jet_mode: { role: hidden }
    switch.portao_social:
      { role: gate, sensor: binary_sensor.portao_social_contato }
    button.reiniciar_roteador: { role: action }
    sensor.electrolux_lavadora_appliancestate:
      role: appliance
      hide: [button.electrolux_lavadora_executecommand_6]
```

A `switch` with no class and no role stays out of the panel and waits on **Revisar o painel**.

### Sensors, security and consumption

These need no role; their class says where they go:

| Entity                                                                 | Shows as                                                                                                                                                                                               |
| :--------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `binary_sensor` `smoke`, `gas`, `carbon_monoxide`, `moisture`          | The red strip on every screen, with or without a room                                                                                                                                                  |
| `binary_sensor` `door`, `window`, `garage_door`, `opening` with a room | A card in Sensores (in edit mode only when it is the `sensor` of a gate of its room), a chip on the home while open, and the security tab. With no room it stays out (the doors of a fridge have none) |
| `binary_sensor` `motion`, `occupancy`, `presence` with a room          | A card in Sensores, and "Ocupado" on the room card                                                                                                                                                     |
| `sensor` `temperature`, `humidity` with a room                         | A card in Sensores, and "24° · 61%" under the room name; a dedicated thermometer wins over the one inside an air conditioner                                                                           |
| `camera`, `alarm_control_panel`                                        | The security tab, with or without a room                                                                                                                                                               |
| `sensor` `power`, `energy` on the device of an outlet or equipment     | The power on its tile and the consumption sheet                                                                                                                                                        |

The class `problem` raises no alert: integrations use it for device faults. Only a sensor that reads
`on` counts: one that is down or unknown says nothing. A multi-channel device matches each switch to
the sensor with the same number at the end (`switch.x_1` with `sensor.x_power_1`); when its switches
were renamed, name the sensors:

```yaml
strategy:
  type: custom:hubb
  entities:
    switch.quarto_tomada:
      { power: sensor.rele_duplo_power_1, energy: sensor.rele_duplo_energy_1 }
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

An item with no room gets a **Cômodo** list and **Mover** (choosing alone saves nothing). The choice is
saved in Home Assistant as the area of that entity, with "Desfazer", and never as the area of its
device: a relay board is one device for its 16 channels, and an area on the device moves all of them.
A switch with no room stays out of the list and of the number on the wrench, since a house has dozens
of system switches; **Mostrar interruptores sem cômodo** lists them by device, so the channels of a
board get their room the same way, and then wait under "Escolha como mostrar" for their role.
The room chosen in the editor of an item takes precedence over the area of Home Assistant.

### Edit the panel

Administrators also get a pencil, on the home and on each room page. In the edit mode:

- **On the home:** arrows under each room card change the order of the rooms, and **Esconder** takes a
  room off the home; the hidden rooms are listed at the bottom with **Mostrar**.
- **On a room page:** a tap on an item opens its editor: the name on the panel, its room, how it shows
  (Luz, Tomada, Equipamento, Aparelho, Ação, Portão or Não mostrar; an air conditioner, a fan, a
  curtain, a TV or a lock shows by its type and offers Não mostrar, and a curtain can become a
  Portão) and its place in its block. A gate on a pulse relay also picks its **Sensor do portão**
  among the door contacts and gate covers of the room. What the
  configuration hides in that room is listed with **Mostrar**.

Every change is saved into the dashboard configuration (the same keys as the YAML above, plus
`entities.<id>.order` for the place of an item) and Home Assistant rebuilds the panel at once;
"Desfazer" takes it back for 5 seconds. A dashboard frozen with "Take control" shows no pencil.

### Who sees what

A room or an item can be hidden for chosen users of Home Assistant: on the home in edit mode, a room
card has **Quem vê**; the item editor has **Quem vê este item**. A room hidden for someone disappears
for them with everything in it (its page, scenes, sensors, cameras, doors and access on the security
tab); an item hidden for someone disappears alone. Administrators always see everything, and the edit
mode tags what is hidden ("Oculto para Lia"). Smoke, gas, carbon monoxide, water leaks and the
alarm still reach everyone. "Revisar o painel" lists the rooms and items hidden for users that no longer exist,
with **Limpar**.

The tabs follow the same rule. In edit mode, Cenas and Segurança each have **Quem vê esta aba**, and
every scene, camera and alarm has its own **Quem vê**. A tab with nothing for someone leaves their
bar. Hiding Cenas from someone takes every scene from them, on the home and in the rooms too; hiding
Segurança takes the alarm card, the cameras and the lists, while doors and gates stay in the rooms
they see. Whoever does not see the alarm still gets "Alarme disparado". Cenas in edit mode also
lists the scenes and scripts of Home Assistant that are not there yet, under **Adicionar cena**.

```yaml
strategy:
  type: custom:hubb
  rooms:
    kitnet:
      hidden_for: [8f3c0d2a1b9e4f7a] # user id in Home Assistant
  entities:
    camera.portao:
      hidden_for: [8f3c0d2a1b9e4f7a]
    script.tv: { role: scene }
  tabs:
    security:
      hidden_for: [8f3c0d2a1b9e4f7a]
```

> [!IMPORTANT]
> This is a filter of the panel, not a permission: Home Assistant has no per-entity permission, so a
> user who opens another dashboard still sees the device there, and the user ids are in the dashboard
> configuration every user reads. Set the other dashboards to "Admin only". A dashboard frozen with
> "Take control" keeps the house of whoever froze it: `hidden_for` no longer applies there.

## Prepare the house

The strategy shows what Home Assistant knows, so the work happens in Home Assistant, once per house:

| What                         | Why                                                                                                                                        | How                                                                                                                                                                                                                         |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every light in an area**   | A light with no area is left out on purpose                                                                                                | The **Cômodo** list in Revisar o painel, or the entity settings with **Use device area** off. Never the area of a relay board's device: it moves all its channels                                                           |
| **Lights as `light.*`**      | Relays exposed as switches or helpers are not lights                                                                                       | A switch that is a light: entity settings, **Show as** Light. ControlArt: the [ControlArt integration](https://github.com/tompsonpecini/controlart). KinCony with Tasmota: `SetOption30 1`. Anything else: a template light |
| **Outlets as outlets**       | Only a switch shown as an outlet reaches the panel on its own                                                                              | Entity settings, **Show as** Outlet, or a [role](#roles). Any other switch waits on **Revisar o painel**                                                                                                                    |
| **Short, client names**      | The tile shows the name as is                                                                                                              | "Sofá", not "Saída 1". A room name at the start or the end is dropped ("LED Sala" in the Sala shows "LED")                                                                                                                  |
| **Scenes in Cenas**          | Only scenes and scripts put in Cenas reach the panel                                                                                       | **Adicionar cena** on Cenas in edit mode, or the label **`hubb_cena`** on a `scene.*` or `script.*`; give it an area to show it on that room too                                                                            |
| **Area pictures** (optional) | Without one, the card shows a drawing picked from the area name or icon ([list](docs/drawings.md))                                         | The picture field of each area                                                                                                                                                                                              |
| **Devices in an area**       | Air conditioners, fans, curtains, TVs, gates and locks show on the room page of their area                                                 | The area field. A gate `cover` needs the class gate, garage or door, or "portão" in its name; a pulse relay gets the [role](#roles) `gate`                                                                                  |
| **Sensors with their class** | Doors, windows, motion, temperature and humidity show on their room; smoke, gas, leaks, cameras and the alarm work with or without an area | The area field, and the right class (entity settings, **Show as** Door, Window, Motion, Smoke, Moisture)                                                                                                                    |
| **Consumption matched**      | The power of an outlet shows when its sensor sits on the same device                                                                       | Nothing for a plug; a multi-channel relay whose switches were renamed needs `power` and `energy` in the [YAML](#sensors-security-and-consumption)                                                                           |
| **Remote control on**        | An Electrolux appliance refuses commands while its remote control is off                                                                   | The remote control button on the appliance itself; the panel says when it is off                                                                                                                                            |

Hidden and diagnostic entities never show up on their own (an appliance still reads its diagnostic
time left), and neither does anything without an area, which is why the per-browser screen lights
that Browser Mod creates stay out by themselves.

## Compatibility

Requires **Home Assistant 2026.5 or newer**, the release that lists community strategies in the _Add
dashboard_ dialog. Strategies themselves are an official frontend extension point since 2021.5, and
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

### Preview

```bash
npm run preview    # builds, then serves http://127.0.0.1:4173
```

Draws the real bundle over a made-up house ([`dev/mock-house.js`](dev/mock-house.js)): seven rooms,
coloured lights, an air conditioner, a curtain, a TV, two speakers playing together, a gate and a lock,
a washer, an alarm and two cameras. Pick the screen with the address: `?view=home`, `?view=sala`, `?view=seguranca`,
`?view=revisar&admin=1`; add `theme=light`, `alert=1` (smoke in the kitchen), `offline=1`, `edit=1`,
`code=1` (alarm with a keypad), or open a sheet with `sheet=light|climate|media|cover|power|appliance`
and `id=<entity or device id>`. The screenshots of this README are taken from it at 390 × 844.

## License

MIT. See [LICENSE](./LICENSE). Manrope, embedded in `hubb-ha-ui.js`, is under the SIL Open Font
License 1.1: see [`LICENSES/OFL-1.1-Manrope.txt`](LICENSES/OFL-1.1-Manrope.txt).

Not affiliated with, endorsed by or sponsored by Home Assistant or the Open Home Foundation.
