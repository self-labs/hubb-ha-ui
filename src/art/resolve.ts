import type { ArtId } from './drawings';

/** Lowercase, no accents, no digits or punctuation: "Consultório 3" becomes "consultorio". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/**
 * Keywords per drawing, normalized, as a client names an area in Portuguese. A keyword of several
 * words must appear in that order. A word of the name also matches the keyword's plural: "s" or "es"
 * added ("Vinhos", "Bares"), "ão" made "ões" ("Reuniões") and "m" made "ns" ("Jardins"). The longest
 * keyword wins; on a tie, the one nearer the start of the name,
 * because the first noun says what the room is ("Banheiro da Suíte" is a bathroom).
 */
export const KEYWORDS: ReadonlyArray<readonly [ArtId, readonly string[]]> = [
  ['sala', ['estar', 'living']],
  ['jantar', ['jantar']],
  ['tv', ['tv', 'home theater', 'cinema']],
  ['quarto', ['dormitorio']],
  ['suite', ['suite', 'master']],
  ['crianca', ['crianca', 'bebe', 'infantil', 'kids']],
  ['hospedes', ['hospede', 'quarto de visita']],
  ['closet', ['closet', 'vestir']],
  ['cozinha', ['cozinha']],
  ['copa', ['copa', 'cafe', 'cafeteria']],
  ['gourmet', ['gourmet', 'churrasqueira', 'churrasco']],
  ['varanda', ['varanda', 'sacada']],
  ['terraco', ['terraco', 'cobertura', 'rooftop']],
  ['jardim', ['jardim', 'quintal', 'horta']],
  ['piscina', ['piscina', 'pool']],
  ['banheiro', ['banheiro', 'wc', 'ducha']],
  ['lavabo', ['lavabo', 'toalete', 'toilette']],
  ['lavanderia', ['lavanderia', 'servico']],
  ['escritorio', ['escritorio', 'home office', 'estudio']],
  ['biblioteca', ['biblioteca', 'leitura']],
  ['academia', ['academia', 'fitness', 'ginastica']],
  ['adega', ['adega', 'vinho']],
  ['brinquedoteca', ['brinquedoteca', 'brinquedo']],
  ['sauna', ['sauna', 'spa', 'ofuro']],
  ['garagem', ['garagem']],
  ['entrada', ['entrada', 'hall', 'foyer']],
  ['corredor', ['corredor', 'circulacao']],
  ['escada', ['escada']],
  ['deposito', ['deposito', 'despensa', 'almoxarifado']],
  ['recepcao', ['recepcao']],
  ['espera', ['espera']],
  // "Sala de Atendimento 2" is a treatment room, not the front desk.
  ['consultorio', ['consultorio', 'medico', 'atendimento']],
  ['procedimento', ['procedimento', 'maca', 'exame', 'massagem', 'drenagem', 'depilacao']],
  ['estetica', ['estetica', 'facial', 'beleza', 'laser']],
  ['esterilizacao', ['esterilizacao', 'expurgo', 'cme']],
  ['laboratorio', ['laboratorio', 'analise']],
  ['salao', ['mesa', 'restaurante']],
  ['bar', ['bar', 'balcao', 'drink']],
  ['cozinha-industrial', ['cozinha industrial', 'producao']],
  ['camara-fria', ['camara fria', 'freezer', 'refrigeracao']],
  ['caixa', ['caixa', 'checkout', 'pagamento']],
  ['deck', ['area externa', 'deck', 'mesa externa']],
  ['open-space', ['open space', 'estacao', 'estacoes', 'baia']],
  ['reuniao', ['reuniao', 'meeting']],
  ['diretoria', ['diretoria', 'presidencia', 'gerencia']],
  ['auditorio', ['auditorio', 'treinamento']],
  ['refeitorio', ['refeitorio', 'cantina']],
  ['loja', ['loja', 'venda', 'showroom', 'show room']],
  ['vitrine', ['vitrine']],
  ['provador', ['provador']],
  ['estoque', ['estoque']],
  ['fachada', ['fachada', 'letreiro']],
  ['salao-beleza', ['salao de beleza', 'cabeleireiro', 'barbearia']],
  ['sala-aula', ['aula', 'classe', 'sala de aula']],
  ['estacionamento', ['estacionamento', 'vaga']],
  ['palco', ['palco', 'show', 'evento']],
  ['quarto-hotel', ['apartamento', 'hotel']],
];

/**
 * Words that only say "a room". They count only when nothing else matched: "Sala de Jantar" is a
 * dining room, "Sala" alone is a living room.
 */
const GENERIC: ReadonlyArray<readonly [ArtId, string]> = [
  ['sala', 'sala'],
  ['quarto', 'quarto'],
  ['salao', 'salao'],
];

/** Area icons people pick in Home Assistant, for an area whose name matched nothing. */
const ICONS: Readonly<Record<string, ArtId>> = {
  'mdi:sofa': 'sala',
  'mdi:sofa-outline': 'sala',
  'mdi:sofa-single': 'sala',
  'mdi:sofa-single-outline': 'sala',
  'mdi:table-chair': 'jantar',
  'mdi:silverware-fork-knife': 'jantar',
  'mdi:table-furniture': 'jantar',
  'mdi:television': 'tv',
  'mdi:television-classic': 'tv',
  'mdi:theater': 'tv',
  'mdi:projector': 'tv',
  'mdi:bed': 'quarto',
  'mdi:bed-outline': 'quarto',
  'mdi:bed-double': 'quarto',
  'mdi:bed-double-outline': 'quarto',
  'mdi:bed-queen': 'quarto',
  'mdi:bed-queen-outline': 'quarto',
  'mdi:bed-empty': 'quarto',
  'mdi:bed-king': 'suite',
  'mdi:bed-king-outline': 'suite',
  'mdi:baby-carriage': 'crianca',
  'mdi:baby-face-outline': 'crianca',
  'mdi:teddy-bear': 'crianca',
  'mdi:human-child': 'crianca',
  'mdi:bed-single': 'hospedes',
  'mdi:bed-single-outline': 'hospedes',
  'mdi:hanger': 'closet',
  'mdi:wardrobe': 'closet',
  'mdi:wardrobe-outline': 'closet',
  'mdi:stove': 'cozinha',
  'mdi:countertop': 'cozinha',
  'mdi:countertop-outline': 'cozinha',
  'mdi:chef-hat': 'cozinha',
  'mdi:fridge': 'cozinha',
  'mdi:fridge-outline': 'cozinha',
  'mdi:pot-steam': 'cozinha',
  'mdi:coffee': 'copa',
  'mdi:coffee-outline': 'copa',
  'mdi:coffee-maker': 'copa',
  'mdi:grill': 'gourmet',
  'mdi:grill-outline': 'gourmet',
  'mdi:balcony': 'varanda',
  'mdi:flower': 'jardim',
  'mdi:flower-outline': 'jardim',
  'mdi:flower-tulip': 'jardim',
  'mdi:tree': 'jardim',
  'mdi:tree-outline': 'jardim',
  'mdi:sprout': 'jardim',
  'mdi:grass': 'jardim',
  'mdi:pool': 'piscina',
  'mdi:shower': 'banheiro',
  'mdi:shower-head': 'banheiro',
  'mdi:bathtub': 'banheiro',
  'mdi:bathtub-outline': 'banheiro',
  'mdi:toilet': 'lavabo',
  'mdi:washing-machine': 'lavanderia',
  'mdi:tumble-dryer': 'lavanderia',
  'mdi:iron': 'lavanderia',
  'mdi:iron-outline': 'lavanderia',
  'mdi:desk': 'escritorio',
  'mdi:desk-lamp': 'escritorio',
  'mdi:laptop': 'escritorio',
  'mdi:monitor': 'escritorio',
  'mdi:briefcase': 'escritorio',
  'mdi:briefcase-outline': 'escritorio',
  'mdi:bookshelf': 'biblioteca',
  'mdi:book-open-variant': 'biblioteca',
  'mdi:library': 'biblioteca',
  'mdi:dumbbell': 'academia',
  'mdi:weight-lifter': 'academia',
  'mdi:glass-wine': 'adega',
  'mdi:bottle-wine': 'adega',
  'mdi:bottle-wine-outline': 'adega',
  'mdi:toy-brick': 'brinquedoteca',
  'mdi:toy-brick-outline': 'brinquedoteca',
  'mdi:hot-tub': 'sauna',
  'mdi:spa': 'sauna',
  'mdi:spa-outline': 'sauna',
  'mdi:garage': 'garagem',
  'mdi:garage-variant': 'garagem',
  'mdi:garage-open': 'garagem',
  'mdi:car': 'garagem',
  'mdi:door': 'entrada',
  'mdi:door-open': 'entrada',
  'mdi:door-closed': 'entrada',
  'mdi:stairs': 'escada',
  'mdi:stairs-up': 'escada',
  'mdi:stairs-down': 'escada',
  'mdi:package-variant': 'deposito',
  'mdi:package-variant-closed': 'deposito',
  'mdi:archive': 'deposito',
  'mdi:archive-outline': 'deposito',
  'mdi:room-service': 'recepcao',
  'mdi:room-service-outline': 'recepcao',
  'mdi:seat': 'espera',
  'mdi:seat-outline': 'espera',
  'mdi:stethoscope': 'consultorio',
  'mdi:doctor': 'consultorio',
  'mdi:hospital-box': 'consultorio',
  'mdi:hospital-box-outline': 'consultorio',
  'mdi:medical-bag': 'procedimento',
  'mdi:needle': 'procedimento',
  'mdi:face-woman-shimmer': 'estetica',
  'mdi:face-woman-shimmer-outline': 'estetica',
  'mdi:lipstick': 'estetica',
  'mdi:flask': 'laboratorio',
  'mdi:flask-outline': 'laboratorio',
  'mdi:microscope': 'laboratorio',
  'mdi:test-tube': 'laboratorio',
  'mdi:silverware': 'salao',
  'mdi:silverware-variant': 'salao',
  'mdi:food': 'salao',
  'mdi:food-fork-drink': 'salao',
  'mdi:glass-cocktail': 'bar',
  'mdi:beer': 'bar',
  'mdi:beer-outline': 'bar',
  'mdi:glass-mug-variant': 'bar',
  'mdi:fridge-industrial': 'camara-fria',
  'mdi:fridge-industrial-outline': 'camara-fria',
  'mdi:snowflake': 'camara-fria',
  'mdi:cash-register': 'caixa',
  'mdi:point-of-sale': 'caixa',
  'mdi:umbrella-beach': 'deck',
  'mdi:umbrella-beach-outline': 'deck',
  'mdi:table-picnic': 'deck',
  'mdi:account-group': 'reuniao',
  'mdi:account-group-outline': 'reuniao',
  'mdi:projector-screen': 'reuniao',
  'mdi:projector-screen-outline': 'reuniao',
  'mdi:account-tie': 'diretoria',
  'mdi:presentation': 'auditorio',
  'mdi:podium': 'auditorio',
  'mdi:store': 'loja',
  'mdi:store-outline': 'loja',
  'mdi:shopping': 'loja',
  'mdi:shopping-outline': 'loja',
  'mdi:storefront': 'vitrine',
  'mdi:storefront-outline': 'vitrine',
  'mdi:tshirt-crew': 'provador',
  'mdi:tshirt-crew-outline': 'provador',
  'mdi:warehouse': 'estoque',
  'mdi:forklift': 'estoque',
  'mdi:content-cut': 'salao-beleza',
  'mdi:hair-dryer': 'salao-beleza',
  'mdi:hair-dryer-outline': 'salao-beleza',
  'mdi:mirror': 'salao-beleza',
  'mdi:school': 'sala-aula',
  'mdi:school-outline': 'sala-aula',
  'mdi:google-classroom': 'sala-aula',
  'mdi:parking': 'estacionamento',
  'mdi:car-multiple': 'estacionamento',
  'mdi:microphone-variant': 'palco',
  'mdi:drama-masks': 'palco',
  'mdi:home': 'casa',
  'mdi:home-outline': 'casa',
  'mdi:office-building': 'predio',
  'mdi:office-building-outline': 'predio',
  'mdi:domain': 'predio',
};

const TABLE = KEYWORDS.flatMap(([art, keys]) => keys.map((key) => ({ art, words: key.split(' ') })));

const same = (word: string, key: string): boolean =>
  word === key ||
  word === `${key}s` ||
  word === `${key}es` ||
  (key.endsWith('ao') && word === `${key.slice(0, -2)}oes`) ||
  (key.endsWith('m') && word === `${key.slice(0, -1)}ns`);

/** Where `phrase` starts in `words`, or -1. */
function find(words: readonly string[], phrase: readonly string[]): number {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    if (phrase.every((p, j) => same(words[i + j]!, p))) return i;
  }
  return -1;
}

export function artFromName(name: string): ArtId | null {
  const words = normalizeName(name).split(' ').filter(Boolean);
  let best: { art: ArtId; len: number; at: number } | null = null;
  for (const k of TABLE) {
    const at = find(words, k.words);
    if (at === -1) continue;
    if (!best || k.words.length > best.len || (k.words.length === best.len && at < best.at)) {
      best = { art: k.art, len: k.words.length, at };
    }
  }
  if (best) return best.art;
  let generic: { art: ArtId; at: number } | null = null;
  for (const [art, word] of GENERIC) {
    const at = find(words, [word]);
    if (at !== -1 && (!generic || at < generic.at)) generic = { art, at };
  }
  return generic?.art ?? null;
}

export function artFromIcon(icon: string | null | undefined): ArtId | null {
  return icon && Object.hasOwn(ICONS, icon) ? ICONS[icon]! : null;
}

/** The drawing for an area: by its name, else by its icon, else the default of the place. */
export function artFor(name: string, icon: string | null | undefined, fallback: ArtId = 'casa'): ArtId {
  return artFromName(name) ?? artFromIcon(icon) ?? fallback;
}
