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
  soon: 'Em breve',
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
  emptyScenesAdmin: 'Crie uma cena e dê a ela o rótulo hubb_cena.',
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
  unknownRole: (r: string): string => `role: ${r} não existe. Use light, outlet, equipment, appliance, action ou hidden.`,
  roleDoesNotFit: (r: string, domain: string): string => `role: ${r} não serve para ${domain}.`,
  applianceNeedsDevice: (id: string): string => `${id} não tem dispositivo, então não pode ser role: appliance.`,
  categoryRole: (id: string): string => `${id} é uma entidade de configuração do Home Assistant e não vai para o painel.`,
  applianceNoState: (id: string): string =>
    `Não achei o estado do aparelho de ${id}. Marque com role: appliance o sensor de estado dele.`,
  badName: (id: string): string => `name de ${id} precisa ser um texto.`,
  applianceOnly: (key: string): string => `${key} só vale junto com role: appliance.`,
  badRooms: 'rooms precisa listar áreas, por exemplo rooms: { sala: { order: 1 } }.',
  badOrder: (id: string): string => `order de ${id} precisa ser um número.`,
  badIcon: (i: string): string => `icon: ${i} precisa começar com mdi: (por exemplo, mdi:pool).`,
  unknownArea: (a: string): string => `A área ${a} não existe no Home Assistant.`,
  unknownArt: (a: string): string => `art: ${a} não é um desenho conhecido.`,
  unknownFloor: (f: string): string => `floor: ${f} não existe no Home Assistant.`,
} as const;

/** The screen "Revisar o painel", for the installer. */
export const REVIEW = {
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
  },
  noClass: 'Não aparece no painel até você escolher como mostrar.',
  applianceFound: 'Toque em Aparelho para mostrar no painel.',
  noArea: 'Não aparece no painel porque não está em nenhuma área. Ponha numa área em Configurações > Áreas.',
  silentSince: (when: string): string => `Sem resposta desde ${when}.`,
  key: (n: number): string =>
    n === 0 ? 'Revisar o painel' : n === 1 ? 'Revisar o painel: 1 pendência' : `Revisar o painel: ${n} pendências`,
} as const;

/** The roles as the installer reads them. */
export const ROLE_LABELS = {
  light: 'Luz',
  outlet: 'Tomada',
  equipment: 'Equipamento',
  appliance: 'Aparelho',
  action: 'Ação',
  hidden: 'Não mostrar',
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
} as const;
