# Changelog

All notable changes to Hubb HA UI are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versions follow **CalVer `YYYY.M.R`** (year, month with no leading zero, revision within the month),
**not** Semantic Versioning.

## [Unreleased]

### Changed

- An appliance switched off offers **Iniciar** alone, no longer Ligar beside it: Iniciar already
  switches it on first, and an Electrolux washer runs its program on Ligar alone, so the two buttons
  did the same thing. An appliance with no Iniciar still offers Ligar.

### Fixed

- An Echo set up through Home Assistant's own **Alexa Devices** integration still showed as a speaker
  card: only the Echos of Alexa Media Player left the panel. Both are the microphone of the house now.
- Play on a speaker whose Music Assistant song had stopped woke the stream that had already ended: it
  played a few seconds and stopped. The card and the sheet keep Music Assistant while the speaker
  rests on its song, so play resumes the queue there; a speaker on a song of its own (its Spotify)
  keeps showing it.
- **Tocar junto** let a TV that was off join the group: Music Assistant moved everyone to AirPlay and
  nothing played. A speaker that is off now shows "Desligado" there and joins once it is on.

## [2026.10.20] - 2026-10-23

### Added

- **Mídia** in the bar, with two or more speakers: every room with sound in one place, how many play,
  **Pausar tudo**, and the sheet of each speaker right there. `tabs.media.hidden_for` hides it.
- **Tocar algo** on the sheet of a speaker with Music Assistant: a search, the songs played last and
  the playlists of the house's Spotify; a tap plays it in that room.
- **Tocar junto across brands:** with Music Assistant, a speaker plays together with any other
  speaker that has a Music Assistant player (a TV, a receiver), still with the Canal and the stereo
  pair of the speakers that have them.
- `entities.<id>.music_assistant` forces the pair of a speaker and its Music Assistant player, or
  turns it off (`''`); the role `media` brings back a player the panel leaves out, such as an Echo.

### Changed

- **One card per speaker:** the second player Music Assistant gives every speaker no longer shows as
  a card of its own; the speaker's card shows and commands what Music Assistant plays. Fonte has one
  **Spotify**, which resumes Music Assistant in that room (or opens Tocar algo with nothing to resume).
- **Echos** are off the panel: they are the microphone of the house.

### Fixed

- A speaker playing through Music Assistant showed no time and could not go to the next song or
  shuffle: by DLNA it only sees a stream, and those commands now go to Music Assistant.

## [2026.10.19] - 2026-10-22

### Fixed

- A second tap on **Iniciar** while it switched a washer on could turn it off: once the washer said
  "Pronta para iniciar", the row became Iniciar and Desligar, with Desligar where Iniciar had been.
  Until the washer runs, the row now stays as it was tapped, takes no tap, and Iniciar says
  **Ligando…** and then **Iniciando…**; a page rebuilt meanwhile keeps it.

## [2026.10.18] - 2026-10-22

### Added

- **Tablet layout.** On a screen 600 px or wider the panel spreads out: upright, three rooms and four
  scenes a row; lying down (900 by 600 px or more), a column on the left with the clock, the weather
  now and of the next hours, the house in pills (lights on, air conditioners on, doors and windows
  open, the power now), the scenes, the rooms and the song playing, and the room picked open on the
  right, its name, "Apagar tudo" and its scenes at the top beside its drawing. Each column scrolls by
  itself, never sideways and with no scroll bar. The bar becomes a rail on the left and a sheet opens
  as a window in the middle. The room picked last is remembered on the tablet. **Esconder**, at the
  foot of the rail, puts the rail away on every screen, and a handle on the left edge brings it back;
  the tablet remembers it.
- **Wall tablet.** In **Ajustes** (the gear of the edit mode) an administrator marks the user logged
  in on a wall tablet: the room it opens on, the minutes before it rests (2, 5, 10, 15 or never), the
  sensor that wakes it and the Home Assistant app of the device. Resting shows the time, the weather
  and one line about the house, and the app dims the screen (an iPad in Kiosk mode, an Android that
  allows "Modify system settings"); a touch or someone passing by wakes it on its room. The YAML keys
  are `tablets.<user id>` and `house_power`.
- **Ar ligado**: a chip on the phone and a pill on the tablet list the air conditioners on, each with
  its room and temperature, with **Desligar todos**.
- A scene shows the icon Home Assistant gives it, or one read from its name (a moon for "Boa noite").
- **Tipo de lugar.** Home Assistant asks the kind of place when the dashboard is created, and
  **Ajustes** changes it later, with Desfazer. A business shows Início with a building on the first
  tab and says "o local" where a home says "a casa" (out of reach, no security, only administrators).
  A new dashboard is named after the place in Home Assistant, not "Casa".
- **Alertas** on the Segurança tab: the smoke, gas, carbon monoxide and leak sensors that are on now,
  each by its name and room, in red. The strip of an alert with no room leads there, and the tab
  used to show nothing of it.

### Changed

- On a tablet, a scene with no size chosen is Pequeno (four a row) instead of half the row.
- A player playing says what plays ("Pieces · KVSH"), not "Tocando" before it: the card already shows
  it plays. "Tocando" stays only when there is nothing else to say.
- The display light of an air conditioner reads **Luz do display** on its sheet and in its editor:
  LG ThinQ calls it "Iluminação", which read like the lights of the room.
- A fan offers its own speeds: 33, 66 and 100% for a fan of three, instead of 25, 50, 75 and 100,
  which matched none of them; a fan with many speeds offers four of them, and one with a single speed
  none.
- An air conditioner, a fan, a curtain, a TV, a gate or a lock named only after its room (the device
  "Sala" in the Sala) shows what it is ("Ar", "Cortina 1"), like lights and outlets do.

### Fixed

- **Iniciar** did nothing on an Electrolux washer switched off: it says "Idle" after Desligar and
  ignores Iniciar until Ligar, and the sheet took Idle for switched on. Idle now reads **Desligada**,
  the sheet offers Ligar and Iniciar, and Iniciar switches the appliance on first, waits up to 10 s
  for it to wake and only then starts it; when it does not wake, Iniciar is not sent and the button
  says "Sem resposta".
- **Mover** in Revisar o painel failed on an entity named after its device (a one-channel switch, a
  speaker): Home Assistant 2026.10 refuses an area on an entity with no name of its own ("set the area
  on its device instead"). Mover now puts the area on that device, with the same Desfazer; the
  channels of a relay board, which have their own names, still get the area of the entity.

- The time of a song ran ahead on a device whose clock is not the one of Home Assistant: an iPad 74 s
  ahead showed a song that had just started at 1:14, and the right time once paused. The bar now
  counts on the clock of the server, learned from the states as they arrive.
- A sheet closed by itself when a tap inside it made Home Assistant rebuild the page: the switch of
  **Tocar junto** (the WiiM group player shows itself when speakers join), and any action that
  changes a registry. Every sheet of the panel (lights on, appliance, dimmer, air conditioner,
  curtain, media, consumption, editor, Quem vê) now opens again on the rebuilt page, until it is
  closed.
- − and + on a player that does not report its volume set it to 5% or to zero: they now take the
  player's own step, and the volume bar stays out until the level is known. Volume de todas too.
- A list of the media sheet (source, sound mode, channel) or a function of an air conditioner with no
  current value showed its first choice, which then could not be picked; an app on the TV that is not
  among its inputs shows by its name. A setting of an air conditioner with no value no longer reads
  "Outra opção".
- A slide moved forward with the arrow keys kept its place after the focus left it: one press much
  later opened the gate. Leaving the slide now takes it back.
- A tap on a curtain closing, when it cannot stop, sent close again and nothing happened: it turns
  back, as one opening does.
- While the house is out of reach, the dimmed page and an open sheet still took the keyboard and
  screen readers, and the sheet took taps: both are out of reach now; the strips, the bar and closing
  the sheet still work.
- A Tasmota plug never showed **Hoje**: it has three energy sensors (today, yesterday, total). The
  one that keeps statistics and only grows is picked.
- The keypad of the alarm told a screen reader nothing about the code: it now says how many digits
  it holds ("Código: 2 dígitos").
- A tap on the alert strip of the page already open stacked a second entry, so the back gesture
  stayed on the same page.
- The first badge of the README showed as a broken image inside HACS. HACS rewrites a relative link
  by prefixing the first `(` of the line, and the badge line ended in `./LICENSE`, so the prefix
  landed on the first badge's image. The licence badge now links with an absolute URL.

## [2026.10.17] - 2026-10-19

### Added

- **Canal of each speaker** on the leader's sheet, in Tocar junto, and **Formar par estéreo** for a
  group of two (left on the leader, right on the other).
- A group mark next to the name of a grouped speaker, which says who it plays with.

### Changed

- The card of a speaker in a group shows the song again, not "Tocando junto com ..."; a line longer
  than the card scrolls to its end and back (still when the phone asks for less motion).
- The sheet fits a phone better: a smaller cover and no "Tocando" under the music, which the pause
  button already says.

### Fixed

- WiiM's "Group Master" player showed as a second card of the leader, with the same music.
- The sheet of a speaker in someone else's group showed its own stale repeat and shuffle (seen on
  WiiM: "repeat all" on the member while the leader repeated nothing): its sheet and the play button
  of its card now show and command the leader's music.
- The sheet of a member offered its source list, whose choice takes it out of the group.
- A speaker that left a group kept playing one side only (left or right): it goes back to stereo,
  and so does a leader left alone.
- The leader of a group is the one the integration calls `master` (`group_role`), no longer the
  first speaker of the list.

## [2026.10.16] - 2026-10-19

### Added

- **Mídia with the music:** the card shows the cover of what plays and bars that move while it
  plays (still when the phone asks for less motion), and says "Tocando junto com ..." in a group.
  The sheet has the cover large, the title and the artist with the album, the time of the song
  (dragged to seek when the player can), repeat, previous, play, next and shuffle in five fixed
  places, a volume bar, the sound mode when there is a choice, and **Canal** (Estéreo, Esquerdo,
  Direito) when the speaker's integration has the channel select (WiiM, `output_channel`).
- **Spotify on the speaker:** a Spotify player is no longer a card. While it plays on a speaker of
  the panel, that speaker's card and sheet show its music and send it play, pause and the tracks.
- **Tocar junto:** the sheet of a speaker lists the other speakers the resident sees, of the same
  integration, each with a switch that groups them in Home Assistant. A speaker in another group
  offers only Sair do grupo, naming the leader; the leader adds Volume de todas.

### Fixed

- Quick taps on − or + of the volume went from the volume Home Assistant had not updated yet, so
  three taps moved it one step. They now add up from the target and leave as one command.

## [2026.10.15] - 2026-10-16

### Fixed

- Each **Mover** in Revisar o painel closed "Mostrar interruptores sem cômodo" and sent the page back
  to the top: Home Assistant makes a new screen after every registry change. The open list, the rooms
  already chosen and the place in the list now survive it, with the focus on the next room list.

## [2026.10.14] - 2026-10-16

### Added

- **Cômodo** in Revisar o painel: an item with no room gets a list of the rooms and **Mover**, and
  the choice is saved in Home Assistant as the area of that entity, with Desfazer, never as the area
  of its device. On a relay board, one device for its 16 channels, the area of the device moved every
  channel to the same room. **Mostrar interruptores sem cômodo** lists the switches with no room by
  device (they stay out of the count on the wrench), so the channels of a board get their room there
  too. The notices of the review and of the empty home say so.

### Changed

- The README says how to make the panel everyone's default dashboard (**Set as default** on
  Settings → Dashboards), so that residents open Home Assistant straight on it, also with
  kiosk-mode hiding the sidebar.

## [2026.10.13] - 2026-10-16

### Added

- **Residents see the panel alone:** with [kiosk-mode](https://github.com/NemesisRE/kiosk-mode)
  installed from HACS, the header and the sidebar of Home Assistant are hidden for every user who is
  not an administrator. The panel asks for it by itself; administrators keep both.
- **Sensor do portão:** a gate on a pulse relay can take a door contact (class door, garage door or
  opening) or a gate cover as its sensor, in its editor, which offers those of its room, or with
  `entities.<id>.sensor`. Its card then says Aberto or Fechado, opens with the slide, closes with a
  tap on Fechar, and says Abrindo… or Fechando… until the sensor moves (90 s at most). Every card of
  the gate on the phone waits with it, and so does any phone that reads the pulse on the relay. While
  the card waits after a pulse, while a cover used as the sensor says the gate is moving, or while the
  sensor does not answer, the card goes back to "Deslize para acionar". The contact shows in the
  Sensores of the gate's room only in edit mode, and still counts as open on the home and in
  Segurança; a cover used as the sensor leaves Acesso.

### Fixed

- The README said the HACS button learns the address of Home Assistant from **Settings → System →
  Network**. my.home-assistant.io keeps it in the browser (`localStorage`, read in its code) and never
  asks Home Assistant: another browser asks again, and `redirect/_change` replaces it.

## [2026.10.12] - 2026-10-15

### Added

- How wide each card is: **Tamanho** in the editor of an item and on each scene of Cenas in edit
  mode, Pequeno, Médio or Grande (a third, half or the whole row; `entities.<id>.size`). Cards with
  buttons or a slide (air conditioner, TV, gate, lock, appliance) always take the whole row.

### Changed

- The scenes of Cenas go two to a row instead of one, at one height per row, and a small one shows as
  a tile, like on the home. An appliance card takes the whole row instead of two thirds.
- The page fades out under and around the bottom bar, and the bar has a hairline border: cards
  scrolling past no longer read as part of it, and one hidden below it takes no tap.

## [2026.10.11] - 2026-10-15

### Added

- Who sees the tabs: **Quem vê esta aba** on Cenas and Segurança in edit mode, and **Quem vê** on each
  scene, camera and alarm (`tabs.<tab>.hidden_for`). A tab with nothing for someone leaves their
  bar; hiding Cenas takes every scene from them, hiding Segurança takes the alarm card, the cameras
  and the lists, while doors and gates stay in their rooms. Whoever does not see the alarm still gets
  "Alarme disparado", and a strip with nowhere to lead only says what happened.
- **Adicionar cena** on Cenas in edit mode: the scenes and scripts of Home Assistant not there yet,
  each marked scene or script, added with a tap (the role `scene`; the `hubb_cena` label still
  works). A scene leaves Cenas with Não mostrar, and "Mostrar como" offers Cena for a script of a
  room. On Segurança the edit mode switches nothing: the alarm and the cameras become rows.

### Fixed

- Two quick changes in the edit mode (two scenes added, two rooms moved) no longer undo each other:
  the saves of the dashboard go one at a time.
- The **Quem vê** sheet closed after each tap, because Home Assistant rebuilds the panel after a
  save: it now opens again on the rebuilt screen, so the installer takes several people out in a
  row. The editor of an item stays open the same way after a Quem vê tap.

## [2026.10.10] - 2026-10-15

### Added

- Who sees what: a room or an item can be hidden for chosen users of Home Assistant (`hidden_for`),
  picked on the panel (**Quem vê** on a room card in edit mode, **Quem vê este item** in the item
  editor). A hidden room disappears with everything in it; administrators always see everything and
  the edit mode tags it; danger alerts and the alarm still reach everyone. An appliance marked by two
  entities hides as one. "Revisar o painel" cleans users that no longer exist, and its key on the home
  counts them. A filter of the panel, not a permission.
- "Mais ajustes" of an air conditioner gathers the functions its device keeps in entities of their
  own, whatever the model: switches (Iluminação, Economia de energia), choices (Volume) and timers
  with − and + (Modo dormir, Ligar daqui a, Desligar daqui a). A board that also drives relays
  (ESPHome, KinCony) keeps them: there only settings count. The power switch, sensors and
  diagnostics stay out, and so does a function the device does not answer for. They leave the room
  and the review, since they belong to the sheet. The editor of the air conditioner picks them too
  (`entities.<id>.hide`).

### Changed

- The target of an air conditioner moves by whole degrees in every mode, like a remote control, even
  when the integration allows half degrees (an LG in Auto takes 18,5 and keeps 18, tested on a real
  unit); a half degree set elsewhere goes to the next whole one. − and + never move the wrong way, as
  when the device sits below the lowest target Home Assistant allows.

### Fixed

- The sheet of an air conditioner no longer sends a target after the mode changed to one that takes
  none: picking Ventilar right after − or + made LG answer "Command not supported in FAN". A blink of
  the device (a moment unavailable) keeps the taps, which still go out.
- A command the device refuses shows one line on the sheet ("O aparelho não aceitou o comando.",
  with the answer of Home Assistant for administrators) instead of the toast of Home Assistant in
  English, and a refused target goes back to the one the device keeps.

## [2026.10.9] - 2026-10-14

### Added

- `npm run preview`: the real bundle over a made-up house (`dev/`), to see every screen in a
  browser and to take the screenshots of the README.
- **Sensores**, the last block of a room: one card per door, window, presence, temperature and
  humidity sensor, with its icon and what it reads, and its history in Home Assistant on a tap. Each
  sensor is edited like any item (name, room, place, Não mostrar).
- In the edit mode, every item says the integration it comes from ("Ar-condicionado · LG ThinQ"),
  and its editor adds the entity id and the name Home Assistant gives it. "Revisar o painel" lists
  the items with the same name in the same room, with where each comes from: one device seen by two
  integrations. Controls, appliances and sensors are compared each among their own, so a plug named
  after its washer, or the contact of a gate named like the gate, is not flagged.
- The editor of an air conditioner picks the modes and the settings its sheet offers
  (`entities.<id>.modes`, `entities.<id>.controls`); it offers only the settings the sheet would show.

### Changed

- The sheet of an air conditioner is compact: − and + with the power button on top, the modes in
  one row (Desligado is the power button now), and ventilation, swing and preset closed under "Mais
  ajustes". A value neither Home Assistant nor the panel can name ("MiddleTop1", "position_3") stays
  out, a setting left with one choice disappears, and a setting on such a value reads "Outra opção"
  instead of its first choice. The panel's own words come first, so a row never mixes genders
  ("Baixa, Média, Alta, Difusa"), and the swing of an infrared unit names "Mais alta", "Meio" and
  "Mais baixa".
- The thermometer inside an air conditioner stays off the Sensores cards: the air conditioner already
  shows it, and its integration names it in English.
- The sentence of the home is smaller and calmer, and names the rooms only while they are two.
- What is open: the chip of the home carries the icon of a door or a window, the security tab shows
  cards, and the row of words under the header of a room gave way to the Sensores block.
- A door or window sensor with no room stays out of the panel, the security tab included (the four
  doors of a fridge showed there as "sem leitura").
- The README opens with a tour of the panel, with new screenshots of the home, a room, the light and
  air conditioner sheets, the gate, the security tab, the washer, the consumption, the review and
  the edit mode.
- The README says how to prepare a house for the device blocks, the sensors, the consumption and
  the remote control of an appliance, and CLAUDE.md lists the release steps in order.

### Fixed

- On an iPhone, a long press opened a sheet and letting go closed it again: the click of the release
  landed on the dark backdrop. The backdrop now closes the sheet only when the touch began on it, and
  a touch the browser cancels (a swipe) never carries over to the next sheet.
- A room with nothing to control keeps its page while an item is hidden there, so the last sensor
  hidden in it can come back from "Escondidos neste cômodo".
- A thermometer that reads in Fahrenheit says "°F", on its card and on the line of its room.
- A dashboard frozen with "Take control" on an older version builds its Sensores from what its rooms
  carry (open doors by name, presence and temperature by kind), instead of losing them with the row
  of words they replaced.
- The power button of an air conditioner: an infrared unit in an unknown state shows off and the
  button turns it on; a unit that cannot be turned off has no button; turning on a unit without
  `turn_on` picks among the modes the installer kept.
- The review names the right mistake for `controls: fan` (a list is needed) and for `modes` or
  `controls` on something that is not an air conditioner.

## [2026.10.8] - 2026-10-14

### Added

- **Acesso** on the room page, first of all blocks: a gate (`cover` of class gate, garage or door,
  or with no class and named "portão"), a lock, or a pulse relay, button or script with the new
  `gate` role. Opening or unlocking takes a slide to the end, so a pocket tap never opens the house:
  a touch the phone takes away near the end, a second finger or a held arrow key does not fire, and
  the slide waits while a command is on its way. Locking is a tap, and so is closing a gate known
  to be open; a gate of unknown state offers only the slide, since many gates close and open on the
  same pulse. It shows the request at once and says "Sem resposta" when nothing comes back in 3 s.
- **Clima**: an air conditioner shows what it is doing, the target and the temperature now ("27°
  agora"), with a power button; its sheet sets the temperature with − and +, the mode, the
  ventilation, the swing and the preset, each only when the device has it. A fan switches with a tap
  and opens its speeds with a long press.
- **Cortinas**: a tap opens or closes a curtain, and stops it while it moves; a long press opens its
  sheet with Abrir, Parar, Fechar and the position.
- **Mídia**: a TV or a speaker shows what is playing, with play and pause and power; its sheet adds
  the tracks, the volume, mute, the source, and Ligar or Desligar.
- A device controlled by infrared says on its sheet that the state is the last command sent. A
  device that is down shows only "Sem resposta" on its sheet, and one whose state is unknown is
  shown off, with no English word.
- The `gate` role ("Portão"), for `switch`, `button`, `input_button`, `script` and `cover`.
- The editor names the new kinds (Ar-condicionado, Ventilador, Cortina, Mídia, Portão, Fechadura)
  and offers Não mostrar for each; a curtain can become a gate, and go back.
- An appliance says when it cannot take a command from the panel, read from its own connection and
  remote control sensors (Electrolux `connectivityState` and `remoteControl`): the card reads "Sem
  conexão", or "Controle remoto desligado" while it is stopped, and the sheet explains it and greys
  out Iniciar, Pausar and the other commands.
- **Segurança**, the third tab: the alarm (arming is a tap on Em casa, Ausente, Noite or Férias;
  disarming asks for the code, or takes a slide when the alarm has none), the doors and windows open
  now, every gate and lock of the house, and the cameras. The tab shows only when the house has any
  of these. A camera image is taken once, when the tab opens, and a tap opens the live view in Home
  Assistant's own window.
- A red strip on every screen for smoke, gas, carbon monoxide, a leak or the alarm going off
  ("Fumaça · Cozinha"); it vibrates once, leads to the room, and stays while the sensor is on.
- A strip when the house is out of reach ("Sem conexão com a casa. Tentando de novo…"), with the
  controls dimmed until it is back.
- Room sensors: the temperature and the humidity under the room name ("24° · 61%"), "Ocupado" from
  a motion or presence sensor (also on the room card), and what is open ("Janela aberta"), also as
  a chip on the home.
- Consumption: an outlet or equipment with a power sensor on its device says how much it draws
  ("Ligada · 120 W"); a long press opens Consumo with Agora and Hoje. `entities.<id>.power` and
  `.energy` name the sensors when the panel cannot match them.

### Changed

- The Segurança tab no longer shows dimmed as "Em breve": it is there when the house has something
  for it, and gone when it has not. The `seguranca` view sits right after the scenes.
- "Revisar o painel" now also counts, among what has not answered for more than a day, the
  cameras, alarms and sensors the panel shows (a dead smoke sensor is worth a look).
- The message for an unknown `role` lists `gate` too.
- A command, choice or option of the appliance sheet that fails shows one line on the sheet
  ("Lavadora não recebeu o comando.") instead of a toast of Home Assistant per tap, in English and
  with the cloud's address. When the maker's cloud refused it (401, 403), administrators also read
  that the integration lost its access and must be reloaded.
- A switch named "portão" or "gate" is suggested as "Portão" on the review, unless its name says
  it is a light ("Luz do portão", "Refletor portão").
- A name drops the word that tied it to the room: "Ar da sala" in the Sala reads "Ar", "Luz do
  quarto" in the Quarto reads "Luz".

### Fixed

- Saving from "Revisar o painel" or from the edit mode no longer throws you onto another screen
  (the last room) when the change makes a room appear or go: every view keeps its place, with one
  view per area of Home Assistant, empty rooms included.

## [2026.10.7] - 2026-10-13

### Added

- The edit mode, for administrators: a pencil on the home and on each room page. On the home, arrows
  change the order of the rooms and "Esconder" takes a room off the home (hidden rooms come back
  with "Mostrar"). On a room page a tap on an item opens its editor: name on the panel, room, how it
  shows (Luz, Tomada, Equipamento, Aparelho, Ação or Não mostrar) and its place in its block; what
  the configuration hides there is listed with "Mostrar". Every change is saved into the dashboard
  configuration, the panel rebuilds itself, and "Desfazer" takes it back for 5 seconds.
- `entities.<id>.order`: the place of an item inside its block.

### Changed

- "Revisar o painel" saves what you tap: a role goes straight into the dashboard configuration
  and the panel rebuilds itself, with "Desfazer" for 5 seconds; "Aplicar sugestões" (it was
  "Copiar tudo") saves every suggested role at once. Only on a dashboard frozen with "Take control",
  or when Home Assistant refuses the save, it still copies the line of YAML.
- The temperature at the top of the home has the size of the review key beside it, and a tap opens
  the weather of Home Assistant.
- Plainer words on "Revisar o painel": "Escolha como mostrar" (it was "Sem papel"), "Não mostrar"
  (it was "Ocultar"), "Aparelhos encontrados", "Erros no YAML do painel", and a notice that says what
  changed ("Jet mode agora aparece como Luz."). The YAML errors name the key that is wrong
  ("role: ligth não existe. Use light, outlet..."). The resume command of an appliance reads
  "Continuar", like the washer itself.
- "Luminária", "plafon", "sanca" and "teto" in a name suggest the light role.

### Fixed

- The review no longer lists or watches what sits in a room hidden with `rooms.<area>.hidden`.
- An appliance keeps its state sensor when its device name holds a word like "Link", and `hide`
  also applies to the state sensor the panel finds by itself.
- A second button for a command already on the appliance sheet ("Luz ligar" beside "Ligar") shows
  among the smaller ones under its own name instead of disappearing.
- The YAML reader says so for an entry written as a list, a `name` that is not text, `hide`,
  `remaining` or `progress` on anything but an appliance, and `rooms` that is not a list of areas.
- Copying on plain `http://` also works on iOS (the text is selected the way Safari needs).
- A house with no floors no longer reads the device storage on every update.
- "Feito" under one command of the appliance sheet (or under an action) no longer makes that
  button taller than the ones beside it: the line is always reserved.

## [2026.10.6] - 2026-10-13

### Changed

- The commands of the appliance sheet sit on one row, as many columns as buttons (up to three):
  Iniciar, Desligar and Parar side by side.
- Appliance states that the integration leaves in English (Electrolux: "Idle", "End Of Cycle")
  show in Portuguese: Parada, Lavando (Secando for a dryer), Pausada, Pronta para iniciar, Início
  programado, Ciclo concluído, Desligada, Alarme. Any other value still shows as it comes.
- A light, outlet or equipment whose name is only the name of its room (the device "Banheiro" in
  the Banheiro) shows what it is instead: "Luz", "Tomada" or "Equipamento", numbered when the
  room has several ("Luz 1", "Luz 2"). A `name` set in the configuration is kept as it is.

### Fixed

- Lights and outlets named after their device (an empty name in the registry, as Sonoff and
  "Show as" entities have) lost their label: the cards read only "Apagada" and the "Luzes
  acesas" sheet could not tell them apart. They now take the friendly name.

## [2026.10.5] - 2026-10-13

### Fixed

- "Revisar o painel" no longer lists the switches that have no class and no room (AdGuard,
  containers and the like): no role could put them on the panel, and on a real house they buried
  the few switches worth reviewing (106 items on the first house it ran on).

## [2026.10.4] - 2026-10-13

### Added

- Roles from the dashboard configuration (`entities.<entity_id>.role`): a `switch` given the `light`
  role counts as a light everywhere (card, "Apagar tudo", "Apagar todas", the home sentence and
  Desfazer), with its commands sent through `switch.*`.
- The `equipment` role (a `switch` that is a pump, a fan or a heater: "Ligado"/"Desligado", the
  `mdi:` icon of the configuration or a power icon) and the `action` role (a `button`,
  `input_button` or `script` in the new "Ações" block, which says "Feito" for 2 s).
- The room page in fixed blocks: Luzes, Tomadas e equipamentos, Ações. An empty block does not show.
- Appliances: an entity given the `appliance` role turns its device into an appliance card in the
  new "Aparelhos" block ("Lavando · faltam 40 min"). While it works, a "Lavadora · 40 min" button
  shows on the home and the room card says it when no light is on. Its sheet shows how long is
  left, the commands that make sense now (Pausar and Desligar while it works, Iniciar and Desligar
  while it waits switched on, Ligar and Iniciar while it is off), the choices (program, level) and
  the options; an option the program does not take disappears.
- Places: `profile` (`home`, `clinic`, `restaurant`, `office`, `store`, `gym`, `salon`, `hotel`).
  Away from a home the first tab is called "Início" and the drawings follow the place: in a clinic
  "Sala 3" is drawn as a consulting room, in a hotel "Quarto 12" as a hotel room.
- Floors: when the rooms sit on two or more floors of Home Assistant, the home shows one floor at a
  time, with a button per floor and the number of lights on in each; the floor picked last is
  remembered on the device. `rooms.<area>.floor` moves a room to another floor. The sentence at the
  top, the "N acesas" button and its sheet still cover the whole place.
- "Revisar o painel", a screen for administrators only, opened by a wrench at the top of the home
  that shows how many items wait. It lists the switches with no role (with the roles as buttons,
  the suggested one highlighted; modes, displays and the Alexa announcement and communication
  switches are suggested hidden), the appliances of known brands (Electrolux, LG), what has no
  room, the problems of the configuration and what has not answered for more than a day. A tap
  copies the line of YAML; "Copiar tudo" copies the whole `entities:` block. On plain `http://`
  it copies through the old browser command, and when nothing works the line stays on screen to
  copy by hand.
- A value the panel does not know (a role, a profile, a drawing, a floor, an area, an icon without
  `mdi:`) is ignored and listed on "Revisar o painel" instead of breaking the dashboard.

### Changed

- A `switch` with no class and no role still stays out of the panel, and now waits on "Revisar o
  painel" instead of disappearing in silence.
- The room card of a room with no lights speaks about its equipment or a working appliance.

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

[Unreleased]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.20...HEAD
[2026.10.20]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.19...v2026.10.20
[2026.10.19]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.18...v2026.10.19
[2026.10.18]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.17...v2026.10.18
[2026.10.17]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.16...v2026.10.17
[2026.10.16]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.15...v2026.10.16
[2026.10.15]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.14...v2026.10.15
[2026.10.14]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.13...v2026.10.14
[2026.10.13]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.12...v2026.10.13
[2026.10.12]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.11...v2026.10.12
[2026.10.11]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.10...v2026.10.11
[2026.10.10]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.9...v2026.10.10
[2026.10.9]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.8...v2026.10.9
[2026.10.8]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.7...v2026.10.8
[2026.10.7]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.6...v2026.10.7
[2026.10.6]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.5...v2026.10.6
[2026.10.5]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.4...v2026.10.5
[2026.10.4]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.3...v2026.10.4
[2026.10.3]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.2...v2026.10.3
[2026.10.2]: https://github.com/self-labs/hubb-ha-ui/compare/v2026.10.1...v2026.10.2
[2026.10.1]: https://github.com/self-labs/hubb-ha-ui/releases/tag/v2026.10.1
