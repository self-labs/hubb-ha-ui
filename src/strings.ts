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

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
