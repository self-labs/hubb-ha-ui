import type { ApplianceKind } from './model/appliances';

/**
 * Every resident-facing string, in Brazilian Portuguese. Gender-neutral on purpose: room names come
 * from the client, and the code cannot know whether it is "a Sala" or "o Quarto".
 */
export const S = {
  on: 'Acesa',
  off: 'Apagada',
  turningOn: 'Acendendo…',
  turningOff: 'Apagando…',
  noResponse: 'Sem resposta',
  infrared: 'Controle por infravermelho: mostra o último comando enviado.',
  allOff: 'Tudo apagado.',
  restOff: 'O resto está apagado.',
  roomAllOff: 'Tudo apagado',
  roomOff: 'Apagado',
  undo: 'Desfazer',
  home: 'Casa',
  scenes: 'Cenas',
  rooms: 'Ambientes',
  lights: 'Luzes',
  security: 'Segurança',
  lightsOnTitle: 'Luzes acesas',
  turnAllOff: 'Apagar todas',
  turnRoomOff: 'Apagar tudo',
  back: 'Voltar',
  brightness: 'Intensidade',
  color: 'Cor',
  whiteTemp: 'Temperatura do branco',
  navigation: 'Navegação',
  emptyHouse: 'Nenhum ambiente por aqui ainda.',
  emptyHouseAdmin: 'Coloque cada luz numa área em Configurações > Áreas, rótulos e zonas.',
  emptyScenes: 'Nenhuma cena ainda.',
  emptyScenesAdmin: 'Toque no lápis para adicionar uma cena, ou dê a uma cena do Home Assistant o rótulo hubb_cena.',
  panelError: 'Não foi possível montar o painel.',
  outlets: 'Tomadas e equipamentos',
  outletOn: 'Ligada',
  outletOff: 'Desligada',
  switchingOn: 'Ligando…',
  switchingOff: 'Desligando…',
  roomOutletsOff: 'Desligado',
  outletsAllOff: 'Tudo desligado',
  equipmentOn: 'Ligado',
  equipmentOff: 'Desligado',
  actions: 'Ações',
  done: 'Feito',
  appliances: 'Aparelhos',
  lightWord: 'Luz',
  weather: 'Previsão do tempo',
  outletWord: 'Tomada',
  equipmentWord: 'Equipamento',
  noState: 'Sem estado',
  start: 'Início',
  otherFloor: 'Outros',
  floors: 'Andares',
} as const;

/** The colour buttons of the light sheet: the short label under the swatch, and the name read aloud. */
export const PRESET_WORDS = {
  warm: { label: 'Quente', name: 'Branco quente' },
  neutral: { label: 'Neutro', name: 'Branco neutro' },
  cool: { label: 'Frio', name: 'Branco frio' },
  white: { label: 'Branco', name: 'Branco' },
  amber: { label: 'Âmbar', name: 'Âmbar' },
  red: { label: 'Vermelho', name: 'Vermelho' },
  pink: { label: 'Rosa', name: 'Rosa' },
  purple: { label: 'Roxo', name: 'Roxo' },
  blue: { label: 'Azul', name: 'Azul' },
  green: { label: 'Verde', name: 'Verde' },
} as const;

/** "Sala", "Sala e Quarto", "Sala, Quarto e Cozinha". */
export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export const lightsCount = (n: number): string => (n === 1 ? '1 luz acesa' : `${n} luzes acesas`);
export const onCount = (n: number): string => (n === 1 ? '1 acesa' : `${n} acesas`);
export const roomWithLights = (room: string, n: number): string => `${room} com ${lightsCount(n)}.`;
export const lightsInRooms = (n: number, rooms: number): string => `${lightsCount(n)} em ${rooms} ambientes.`;
export const roomStatus = (on: number, total: number): string =>
  on === 0 ? S.roomAllOff : `${on} de ${total} ${total === 1 ? 'luz acesa' : 'luzes acesas'}`;
export const lightsTurnedOff = (n: number): string => (n === 1 ? '1 luz apagada' : `${n} luzes apagadas`);
export const roomTurnedOff = (room: string, n: number): string => `${room}: ${lightsTurnedOff(n)}`;
export const sceneRan = (name: string): string => `Cena ${name}`;
export const noResponseSince = (time: string): string => `Sem resposta desde ${time}`;
export const outletsOnCount = (n: number): string => (n === 1 ? '1 ligada' : `${n} ligadas`);
export const outletStatus = (on: number, total: number): string =>
  on === 0 ? S.outletsAllOff : `${on} de ${total} ${total === 1 ? 'tomada ligada' : 'tomadas ligadas'}`;
/** Outlets and equipment together: the masculine covers both. */
export const devicesOnCount = (n: number): string => (n === 1 ? '1 ligado' : `${n} ligados`);
export const devicesStatus = (on: number, total: number): string =>
  on === 0 ? S.outletsAllOff : `${on} de ${total} ${total === 1 ? 'ligado' : 'ligados'}`;
export const minutesLeft = (n: number): string => (n === 1 ? 'falta 1 min' : `faltam ${n} min`);
export const minutesToFinish = (n: number): string => `${n} min para terminar`;
export const applianceChip = (name: string, detail: string): string => `${name} · ${detail}`;
/** The commands of an appliance sheet. */
export const COMMAND_LABELS = {
  on: 'Ligar',
  off: 'Desligar',
  start: 'Iniciar',
  pause: 'Pausar',
  resume: 'Continuar',
  stop: 'Parar',
} as const;

/** Whether an appliance can take a command from the panel, and what to say when one fails. */
export const REACH = {
  offline: 'Sem conexão',
  remoteOff: 'Controle remoto desligado',
  offlineHint: 'Sem conexão com a internet. Os comandos voltam quando a conexão voltar.',
  remoteOffHint: 'Controle remoto desligado no aparelho. Para usar os comandos daqui, ative o controle remoto no painel do aparelho.',
  failed: (name: string): string => `${name} não recebeu o comando.`,
  /** For administrators only, when the maker's cloud refused the call (401, 403). */
  lostAccess: 'A integração perdeu o acesso à conta do fabricante: recarregue a integração em Configurações, Dispositivos e serviços.',
} as const;

/** The strips at the top of every screen. Gender-neutral: "Fumaça · Cozinha", never "na Cozinha". */
export const STRIP = {
  offline: 'Sem conexão com a casa. Tentando de novo…',
  kind: { smoke: 'Fumaça', gas: 'Gás', carbon_monoxide: 'Monóxido de carbono', moisture: 'Vazamento' } as Readonly<Record<string, string>>,
  alarm: 'Alarme disparado',
  /** Without a room; the participle agrees with the word ("Fumaça detectada", "Gás detectado"). */
  detected: {
    smoke: 'Fumaça detectada',
    gas: 'Gás detectado',
    carbon_monoxide: 'Monóxido de carbono detectado',
    moisture: 'Vazamento detectado',
  } as Readonly<Record<string, string>>,
  at: (what: string, room: string): string => `${what} · ${room}`,
  more: (first: string, n: number): string => `${first} e mais ${n}`,
} as const;

/** What the sensors of a room say. */
export const SENSE = {
  title: 'Sensores',
  /** A door, a garage door, a window: the feminine; an opening of no known kind: the masculine. */
  openState: { door: 'Aberta', window: 'Aberta', garage_door: 'Aberta', opening: 'Aberto' } as Readonly<Record<string, string>>,
  closedState: { door: 'Fechada', window: 'Fechada', garage_door: 'Fechada', opening: 'Fechado' } as Readonly<Record<string, string>>,
  free: 'Livre',
  occupied: 'Ocupado',
  open: { door: 'Porta aberta', window: 'Janela aberta', garage_door: 'Garagem aberta' } as Readonly<Record<string, string>>,
  openNamed: (name: string): string => `Aberto: ${name}`,
  openAt: (what: string, room: string): string => `${what} · ${room}`,
  occupiedLine: (line: string): string => (line ? `Ocupado · ${line}` : 'Ocupado'),
} as const;

/** The alarm panel. */
export const ALARM = {
  title: 'Alarme',
  state: {
    disarmed: 'Desarmado',
    armed_home: 'Armado em casa',
    armed_away: 'Armado ausente',
    armed_night: 'Armado noite',
    armed_vacation: 'Armado férias',
    armed_custom_bypass: 'Armado',
    arming: 'Armando…',
    pending: 'Disparando em instantes',
    triggered: 'Disparado',
    disarming: 'Desarmando…',
  } as Readonly<Record<string, string>>,
  mode: { home: 'Em casa', away: 'Ausente', night: 'Noite', vacation: 'Férias' },
  slideDisarm: 'Deslize para desarmar',
  disarm: 'Desarmar',
  code: 'Código',
  enterCode: 'Digite o código',
  erase: 'Apagar',
  wrongCode: 'Código incorreto',
} as const;

/** The consumption of an outlet or equipment. */
export const POWER = { title: 'Consumo', now: 'Agora', today: 'Hoje' } as const;

/** The security tab. */
export const SECURITY = {
  openNow: 'Abertos agora',
  allClosed: 'Tudo fechado',
  access: 'Acesso',
  cameras: 'Câmeras',
  noImage: 'Sem imagem',
  empty: 'Nenhum alarme, câmera, portão, fechadura ou sensor de porta e janela nesta casa.',
  at: (what: string, room: string | null): string => (room ? `${what} · ${room}` : what),
} as const;

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Problems of the panel configuration, shown on "Revisar o painel". */
export const CFG = {
  unknownProfile: (p: string): string => `profile: ${p} não existe; o painel usou home (Casa).`,
  missingEntity: (id: string): string => `${id} não existe no Home Assistant.`,
  badEntry: (id: string): string => `${id} está sem nada; escreva, por exemplo, ${id}: { role: light }.`,
  unknownRole: (r: string): string => `role: ${r} não existe. Use light, outlet, equipment, appliance, action, gate ou hidden.`,
  roleDoesNotFit: (r: string, domain: string): string => `role: ${r} não serve para ${domain}.`,
  applianceNeedsDevice: (id: string): string => `${id} não tem dispositivo, então não pode ser role: appliance.`,
  categoryRole: (id: string): string => `${id} é uma entidade de configuração do Home Assistant e não vai para o painel.`,
  applianceNoState: (id: string): string =>
    `Não achei o estado do aparelho de ${id}. Marque com role: appliance o sensor de estado dele.`,
  badName: (id: string): string => `name de ${id} precisa ser um texto.`,
  applianceOnly: (key: string): string => `${key} só vale junto com role: appliance.`,
  badRooms: 'rooms precisa listar áreas, por exemplo rooms: { sala: { order: 1 } }.',
  badOrder: (id: string): string => `order de ${id} precisa ser um número.`,
  badList: (key: string, example: string): string => `${key} precisa ser uma lista, por exemplo [${example}].`,
  climateOnly: (key: string): string => `${key} só vale para ar-condicionado (climate).`,
  hideOnly: 'hide só vale para um aparelho (role: appliance) ou um ar-condicionado.',
  badTabs: 'tabs precisa ser um bloco com scenes e security.',
  unknownTab: (key: string): string => `tabs: ${key} não existe. Use scenes ou security.`,
  badControls: (value: string): string => `controls: ${value} não existe. Use fan, swing ou preset.`,
  badIcon: (i: string): string => `icon: ${i} precisa começar com mdi: (por exemplo, mdi:pool).`,
  unknownArea: (a: string): string => `A área ${a} não existe no Home Assistant.`,
  unknownArt: (a: string): string => `art: ${a} não é um desenho conhecido.`,
  unknownFloor: (f: string): string => `floor: ${f} não existe no Home Assistant.`,
} as const;

/** The screen "Revisar o painel", for the installer. */
export const REVIEW = {
  stalePeople: 'Pessoas que não existem mais',
  staleReason: 'Oculto para alguém que não existe mais no Home Assistant.',
  clean: 'Limpar',
  tab: (name: string): string => `Aba ${name}`,
  cleaned: (name: string): string => `${name}: lista de quem vê atualizada.`,
  title: 'Revisar o painel',
  onlyYou: 'Só você vê esta tela.',
  adminOnly: 'Só administradores veem esta tela.',
  nothing: 'Nada para revisar.',
  applyAll: 'Aceitar todas as sugestões',
  savedAs: (name: string, label: string): string => `${name} agora aparece como ${label}.`,
  savedHidden: (name: string): string => `${name} não aparece mais no painel.`,
  savedAll: (n: number): string => (n === 1 ? '1 item salvo.' : `${n} itens salvos.`),
  copiedInstead: 'Não deu para salvar aqui. A linha foi copiada: cole no YAML do painel.',
  copiedAllInstead: 'Não deu para salvar aqui. As linhas foram copiadas: cole no YAML do painel.',
  copyFailed: 'Não deu para salvar nem copiar. Copie a linha abaixo e cole no YAML do painel.',
  groups: {
    role: 'Escolha como mostrar',
    appliance: 'Aparelhos encontrados',
    area: 'Sem cômodo',
    config: 'Erros no YAML do painel',
    silent: 'Sem resposta há mais de um dia',
    duplicate: 'Mesmo nome no mesmo cômodo',
  },
  duplicate: (origin: string | null): string =>
    origin ? `Outro item deste cômodo tem o mesmo nome. Este vem de ${origin}.` : 'Outro item deste cômodo tem o mesmo nome.',
  noClass: 'Não aparece no painel até você escolher como mostrar.',
  applianceFound: 'Toque em Aparelho para mostrar no painel.',
  noArea: 'Não aparece no painel porque não está em nenhuma área. Ponha numa área em Configurações > Áreas.',
  silentSince: (when: string): string => `Sem resposta desde ${when}.`,
  key: (n: number): string =>
    n === 0 ? 'Revisar o painel' : n === 1 ? 'Revisar o painel: 1 pendência' : `Revisar o painel: ${n} pendências`,
} as const;

/**
 * The integrations as an installer knows them, by the id Home Assistant gives them. Names of
 * products and projects, kept as they are written; an id missing here shows as the id itself.
 */
export const ORIGIN: Readonly<Record<string, string>> = {
  alexa_devices: 'Alexa',
  alexa_media: 'Alexa Media',
  broadlink: 'Broadlink',
  browser_mod: 'Browser Mod',
  cast: 'Google Cast',
  controlart: 'ControlArt',
  denonavr: 'Denon',
  electrolux_status: 'Electrolux',
  esphome: 'ESPHome',
  generic: 'Câmera genérica',
  group: 'Grupo',
  heos: 'HEOS',
  hue: 'Philips Hue',
  lg_thinq: 'LG ThinQ',
  localtuya: 'Local Tuya',
  midea_ac_lan: 'Midea',
  mqtt: 'MQTT',
  onvif: 'ONVIF',
  samsungtv: 'Samsung TV',
  shelly: 'Shelly',
  smartir: 'SmartIR',
  smartthinq_sensors: 'SmartThinQ',
  sonoff: 'Sonoff',
  spotify: 'Spotify',
  switch_as_x: 'Mostrar como',
  tasmota: 'Tasmota',
  tasmota_ir: 'Tasmota IR',
  template: 'Template',
  tuya: 'Tuya',
  webostv: 'LG webOS',
  wled: 'WLED',
  xiaomi_miio: 'Xiaomi',
  zha: 'ZHA',
  zwave_js: 'Z-Wave',
};

/** The roles as the installer reads them. */
export const ROLE_LABELS = {
  light: 'Luz',
  outlet: 'Tomada',
  equipment: 'Equipamento',
  appliance: 'Aparelho',
  action: 'Ação',
  gate: 'Portão',
  scene: 'Cena',
  hidden: 'Não mostrar',
} as const;

/** What an item is, on its edit tile and in "Mostrar como": the roles plus the kinds of M3. */
export const KIND_LABELS = {
  ...ROLE_LABELS,
  climate: 'Ar-condicionado',
  fan: 'Ventilador',
  cover: 'Cortina',
  media: 'Mídia',
  lock: 'Fechadura',
  door: 'Porta',
  window: 'Janela',
  garage_door: 'Garagem',
  opening: 'Abertura',
  presence: 'Presença',
  temperature: 'Temperatura',
  humidity: 'Umidade',
} as const;

/**
 * Appliance states some integrations leave in English: Electrolux title-cases its raw values
 * ("Idle", "End Of Cycle") and gives no translation. Feminine, like most appliances (a lavadora).
 */
const APPLIANCE_STATES: Readonly<Record<string, string>> = {
  off: 'Desligada',
  idle: 'Parada',
  'ready to start': 'Pronta para iniciar',
  paused: 'Pausada',
  'delayed start': 'Início programado',
  'end of cycle': 'Ciclo concluído',
  alarm: 'Alarme',
};

const RUNNING: Readonly<Record<ApplianceKind, string>> = {
  washer: 'Lavando',
  dishwasher: 'Lavando',
  dryer: 'Secando',
  other: 'Em funcionamento',
};

/** The Portuguese word for a raw appliance state, or null when the panel does not know it. */
export function applianceStatePt(raw: string, kind: ApplianceKind): string | null {
  const key = raw.trim().toLowerCase().replace(/_/g, ' ');
  return key === 'running' ? RUNNING[kind] : (APPLIANCE_STATES[key] ?? null);
}

/** The edit mode of the panel, for the installer. */
export const EDIT = {
  whoSees: 'Quem vê',
  whoSeesRoom: 'Quem vê este cômodo',
  whoSeesItem: 'Quem vê este item',
  whoSeesTab: 'Quem vê esta aba',
  tabName: (name: string): string => `A aba ${name}`,
  hintScenes: 'Modo edição: escolha quem vê a aba e cada cena, tire uma cena ou adicione outra.',
  hintSecurity: 'Modo edição: escolha quem vê a aba, o alarme e cada câmera. Portão e portas seguem o cômodo.',
  addScene: 'Adicionar cena',
  add: 'Adicionar',
  fromScene: 'Cena do Home Assistant',
  fromScript: 'Script',
  sceneAdded: (name: string): string => `${name} agora está em Cenas.`,
  sceneRemoved: (name: string): string => `${name} saiu de Cenas.`,
  onlyAdmins: 'Nesta casa só há administradores, e eles sempre veem tudo.',
  usersFailed: 'Não deu para ler os usuários do Home Assistant. Feche e abra de novo.',
  hiddenForOne: (name: string): string => `Oculto para ${name}`,
  hiddenForMany: (n: number): string => (n === 1 ? 'Oculto para 1 pessoa' : `Oculto para ${n} pessoas`),
  nowHiddenFor: (item: string, person: string): string => `${item} não aparece mais para ${person}.`,
  nowShownFor: (item: string, person: string): string => `${item} voltou a aparecer para ${person}.`,
  edit: 'Editar',
  done: 'Pronto',
  hintHome: 'Modo edição: use as setas para mudar a ordem dos cômodos. Toque num cômodo para editar os itens dele.',
  hintRoom: 'Modo edição: toque num item para mudar o nome, o cômodo, como ele aparece ou o lugar dele.',
  failed: 'Não deu para salvar. Só um administrador pode mudar o painel.',
  before: 'Antes',
  after: 'Depois',
  hideRoom: 'Esconder',
  hiddenRooms: 'Cômodos escondidos',
  hiddenItems: 'Escondidos neste cômodo',
  show: 'Mostrar',
  name: 'Nome no painel',
  saveName: 'Salvar nome',
  haName: 'Usar o nome do Home Assistant',
  room: 'Cômodo',
  showAs: 'Mostrar como',
  place: 'Lugar no bloco',
  moved: (name: string): string => `${name} mudou de lugar.`,
  renamed: (name: string): string => `Agora se chama ${name}.`,
  nameBack: 'Voltou ao nome do Home Assistant.',
  movedTo: (name: string, room: string): string => `${name} foi para ${room}.`,
  roomHidden: (name: string): string => `${name} não aparece mais na home.`,
  roomShown: (name: string): string => `${name} voltou para a home.`,
  itemShown: (name: string): string => `${name} voltou para o painel.`,
  origin: 'Origem',
  inHa: (name: string): string => `no Home Assistant: ${name}`,
} as const;

/** Gates, doors and locks: the "Acesso" block. Opening always takes a slide. */
export const ACCESS = {
  title: 'Acesso',
  slideOpen: 'Deslize para abrir',
  slideUnlock: 'Deslize para destrancar',
  slideTrigger: 'Deslize para acionar',
  close: 'Fechar',
  lock: 'Trancar',
  cover: { closed: 'Fechado', open: 'Aberto', opening: 'Abrindo…', closing: 'Fechando…' } as Readonly<Record<string, string>>,
  lockState: {
    locked: 'Trancada',
    unlocked: 'Destrancada',
    locking: 'Trancando…',
    unlocking: 'Destrancando…',
    jammed: 'Emperrada',
    open: 'Aberta',
    opening: 'Abrindo…',
  } as Readonly<Record<string, string>>,
  pending: { open: 'Abrindo…', close: 'Fechando…', unlock: 'Destrancando…', lock: 'Trancando…' },
} as const;

/** Air conditioners and fans: the "Clima" block. */
export const CLIMATE = {
  title: 'Clima',
  off: 'Desligado',
  on: 'Ligado',
  now: (t: number): string => `${t}° agora`,
  target: 'Temperatura',
  mode: 'Modo',
  fan: 'Ventilação',
  swing: 'Oscilação',
  preset: 'Predefinição',
  speed: 'Velocidade',
  turnOn: 'Ligar',
  turnOff: 'Desligar',
  colder: 'Diminuir a temperatura',
  more: 'Mais ajustes',
  decrease: (name: string): string => `Diminuir ${name}`,
  increase: (name: string): string => `Aumentar ${name}`,
  /** A timer at zero, or one the device does not report: nothing is scheduled. */
  timerOff: 'Desligado',
  /**
   * Names of the functions an integration leaves in English, by translation key or by name. LG ThinQ
   * translates Iluminação and Economia de energia but not its timers; SmartThinQ translates nothing.
   */
  extraWords: {
    sleep_timer_relative_hour_to_stop: 'Modo dormir',
    relative_hour_to_start: 'Ligar daqui a',
    relative_hour_to_stop: 'Desligar daqui a',
    'sleep timer': 'Modo dormir',
    'schedule turn-on': 'Ligar daqui a',
    'schedule turn-off': 'Desligar daqui a',
    'jet mode': 'Modo Jet',
    'display light': 'Luz do display',
    'energy saving': 'Economia de energia',
  } as Readonly<Record<string, string>>,
  /** A command the device or its cloud refused ("Fail device control"); administrators also read why. */
  refused: 'O aparelho não aceitou o comando.',
  /** A setting on a value nobody can name: the select says so instead of showing its first choice. */
  otherValue: 'Outra opção',
  onPanel: 'No painel',
  saveChoices: 'Salvar escolhas',
  choicesSaved: (name: string): string => `${name} agora mostra só o que você escolheu.`,
  warmer: 'Aumentar a temperatura',
  modes: {
    off: 'Desligado',
    cool: 'Frio',
    heat: 'Calor',
    auto: 'Auto',
    heat_cool: 'Auto',
    dry: 'Seco',
    fan_only: 'Ventilar',
  } as Readonly<Record<string, string>>,
  actions: {
    cooling: 'Resfriando',
    heating: 'Aquecendo',
    drying: 'Desumidificando',
    fan: 'Ventilando',
    idle: 'Em espera',
  } as Readonly<Record<string, string>>,
  fanWords: {
    auto: 'Auto',
    min: 'Mínima',
    low: 'Baixa',
    low_mid: 'Média baixa',
    medium: 'Média',
    mid_high: 'Média alta',
    high: 'Alta',
    max: 'Máxima',
    highest: 'Mais alta',
    middle: 'Meio',
    lowest: 'Mais baixa',
    diffuse: 'Difusa',
    turbo: 'Turbo',
    on: 'Ligada',
    off: 'Desligada',
    none: 'Nenhuma',
    sleep: 'Dormir',
    comfort: 'Conforto',
  } as Readonly<Record<string, string>>,
} as const;

/** Curtains, blinds and awnings: the "Cortinas" block. */
export const COVER = {
  title: 'Cortinas',
  open: 'Aberta',
  closed: 'Fechada',
  opening: 'Abrindo…',
  closing: 'Fechando…',
  openPct: (n: number): string => `${n}% aberta`,
  doOpen: 'Abrir',
  doStop: 'Parar',
  doClose: 'Fechar',
  position: 'Posição',
} as const;

/** TVs and sound: the "Mídia" block. */
export const MEDIA = {
  title: 'Mídia',
  playing: 'Tocando',
  paused: 'Pausado',
  on: 'Ligado',
  off: 'Desligado',
  idle: 'Ligado',
  volume: 'Volume',
  mute: 'Mudo',
  unmute: 'Com som',
  source: 'Fonte',
  play: 'Tocar',
  pause: 'Pausar',
  next: 'Próxima',
  previous: 'Anterior',
  louder: 'Aumentar o volume',
  quieter: 'Diminuir o volume',
  power: 'Ligar ou desligar',
  turnOn: 'Ligar',
  turnOff: 'Desligar',
} as const;
