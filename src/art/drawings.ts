/**
 * Line drawings of rooms, shown on the right of a room card and of a room header when the area has no
 * photo. Each value is the inside of a 140 x 100 drawing stroked in currentColor; the parts styled
 * `fill:var(--glow,none)` are the lamp or the light point, filled in amber while the room has a light
 * on. Extracted from the catalogue approved on 2026-10-11. New drawings go here by hand, in the same
 * style, with their keywords in resolve.ts.
 */
export const ART_IDS = [
  'sala',
  'jantar',
  'tv',
  'quarto',
  'suite',
  'crianca',
  'hospedes',
  'closet',
  'cozinha',
  'copa',
  'gourmet',
  'varanda',
  'terraco',
  'jardim',
  'piscina',
  'banheiro',
  'lavabo',
  'lavanderia',
  'escritorio',
  'biblioteca',
  'academia',
  'adega',
  'brinquedoteca',
  'sauna',
  'garagem',
  'entrada',
  'corredor',
  'escada',
  'deposito',
  'recepcao',
  'espera',
  'consultorio',
  'procedimento',
  'estetica',
  'esterilizacao',
  'laboratorio',
  'salao',
  'bar',
  'cozinha-industrial',
  'camara-fria',
  'caixa',
  'deck',
  'open-space',
  'reuniao',
  'diretoria',
  'auditorio',
  'refeitorio',
  'loja',
  'vitrine',
  'provador',
  'estoque',
  'fachada',
  'salao-beleza',
  'sala-aula',
  'estacionamento',
  'palco',
  'quarto-hotel',
  'casa',
  'predio',
] as const;

export type ArtId = (typeof ART_IDS)[number];

export const DRAWINGS: Record<ArtId, string> = {
  sala:
    '<rect x="22" y="50" width="70" height="20" rx="7"/><path d="M30 50 V40 a7 7 0 0 1 7-7 h40 a7 7 0 0 1 7 7 V50"/><rect x="13" y="46" width="13" height="28" rx="5"/><rect x="88" y="46" width="13" height="28" rx="5"/><path d="M57 50 v20 M22 74 v6 M92 74 v6 M121 36 V84 M113 84 h16"/><path d="M110 36 h22 l-4 -17 h-14 z" style="fill:var(--glow,none)"/>',
  jantar:
    '<path d="M30 58 H110 M38 58 V84 M102 58 V84"/><path d="M16 40 V84 M16 66 H30 M30 66 V84 M124 40 V84 M124 66 H110 M110 66 V84"/><path d="M64 58 v-7 h12 v7"/><path d="M70 0 V16"/><path d="M58 28 a12 12 0 0 1 24 0 z" style="fill:var(--glow,none)"/>',
  tv:
    '<rect x="38" y="14" width="64" height="38" rx="3"/><rect x="44" y="20" width="52" height="26" rx="1" style="fill:var(--glow,none)" opacity=".7"/><rect x="28" y="64" width="84" height="14" rx="2"/><path d="M36 78 v6 M104 78 v6 M56 71 h28"/><rect x="12" y="44" width="10" height="40" rx="2"/><rect x="118" y="44" width="10" height="40" rx="2"/>',
  quarto:
    '<path d="M22 70 V36 a7 7 0 0 1 7-7 h60 a7 7 0 0 1 7 7 V70"/><rect x="16" y="56" width="86" height="17" rx="5"/><rect x="30" y="45" width="24" height="11" rx="4"/><rect x="64" y="45" width="24" height="11" rx="4"/><path d="M20 73 v9 M98 73 v9"/><rect x="110" y="62" width="22" height="20" rx="3"/><path d="M121 62 v-11"/><path d="M112 51 h18 l-3 -13 h-12 z" style="fill:var(--glow,none)"/>',
  suite:
    '<path d="M32 70 V38 a6 6 0 0 1 6-6 h64 a6 6 0 0 1 6 6 V70"/><rect x="28" y="56" width="84" height="17" rx="5"/><rect x="40" y="46" width="26" height="10" rx="4"/><rect x="74" y="46" width="26" height="10" rx="4"/><path d="M32 73 v9 M108 73 v9"/><rect x="4" y="64" width="18" height="18" rx="3"/><rect x="118" y="64" width="18" height="18" rx="3"/><path d="M13 64 v-9 M127 64 v-9"/><path d="M6 55 h14 l-3 -11 h-8 z M120 55 h14 l-3 -11 h-8 z" style="fill:var(--glow,none)"/>',
  crianca:
    '<rect x="18" y="60" width="64" height="14" rx="4"/><path d="M22 74 V44 M78 74 V52 M22 50 H78"/><rect x="28" y="52" width="16" height="8" rx="3"/><path d="M110 0 V12 M94 12 H126 M98 12 v8 M122 12 v6"/><circle cx="98" cy="23" r="3"/><circle cx="122" cy="21" r="3"/><path d="M110 12 v6 l3 7 h7 l-6 4 l2 7 l-6 -4 l-6 4 l2 -7 l-6 -4 h7 z" style="fill:var(--glow,none)"/><circle cx="108" cy="76" r="9"/><path d="M99 76 h18"/>',
  hospedes:
    '<rect x="14" y="36" width="12" height="40" rx="3"/><rect x="14" y="58" width="72" height="15" rx="4"/><rect x="30" y="49" width="18" height="9" rx="3"/><path d="M84 73 v9"/><rect x="100" y="54" width="26" height="30" rx="3"/><path d="M107 54 v-6 h12 v6 M108 84 v2 M118 84 v2 M100 66 h26"/><path d="M64 24 a6 6 0 0 1 12 0 z" style="fill:var(--glow,none)"/><path d="M70 24 v6"/>',
  closet:
    '<path d="M12 20 H128 M12 20 V10 M128 20 V10"/><path d="M40 20 v5 M70 20 v5 M100 20 v5"/><path d="M28 25 h24 l4 38 h-32 z"/><path d="M58 25 h24 v52 h-24 z M70 25 v52"/><path d="M88 25 h24 l6 34 h-36 z"/><path d="M12 86 H128 M30 86 v-5 h12 v5 M96 86 v-5 h12 v5"/><circle cx="70" cy="8" r="4" style="fill:var(--glow,none)"/>',
  cozinha:
    '<path d="M44 0 V20 M80 0 V20 M116 0 V20"/><path d="M34 31 a10 10 0 0 1 20 0 z M70 31 a10 10 0 0 1 20 0 z M106 31 a10 10 0 0 1 20 0 z" style="fill:var(--glow,none)"/><path d="M8 62 H136"/><rect x="14" y="62" width="118" height="24" rx="2"/><path d="M44 62 V86 M74 62 V86 M104 62 V86 M22 62 v-8 h18 v8 M19 54 h24"/>',
  copa:
    '<ellipse cx="70" cy="58" rx="28" ry="6"/><path d="M70 64 V84 M58 84 H82 M30 42 V84 M30 66 H44 M44 66 V84 M110 42 V84 M110 66 H96 M96 66 V84"/><path d="M62 52 h12 v-7 h-12 z M74 47 h3 a2 2 0 0 1 0 4 h-3"/><path d="M70 0 V16"/><path d="M60 26 a10 10 0 0 1 20 0 z" style="fill:var(--glow,none)"/>',
  gourmet:
    '<path d="M22 22 h40 l8 18 h-56 z M36 22 V6 M48 22 V6"/><rect x="16" y="40" width="52" height="20" rx="2"/><path d="M30 50 l4 -4 l4 4 l4 -4 l4 4 l4 -4"/><path d="M8 60 H134 M10 60 V86 M132 60 V86 M72 60 V86"/><path d="M106 0 V18"/><path d="M96 28 a10 10 0 0 1 20 0 z" style="fill:var(--glow,none)"/>',
  varanda:
    '<circle cx="40" cy="26" r="9" style="fill:var(--glow,none)"/><path d="M112 0 V14 M102 14 h20 l-3 12 h-14 z M107 26 c-6 8 -8 16 -6 24 M112 26 c0 10 2 18 6 24 M117 26 c6 6 10 12 10 20"/><path d="M6 58 H136 M6 64 H136 M16 64 V86 M30 64 V86 M44 64 V86 M58 64 V86 M72 64 V86 M86 64 V86 M100 64 V86 M114 64 V86 M128 64 V86"/>',
  terraco:
    '<path d="M14 80 H62 L84 56 M22 80 v6 M58 80 v6"/><path d="M110 86 V30 M84 30 a26 14 0 0 1 52 0 z"/><path d="M4 10 q34 16 66 0 q34 16 66 0"/><circle cx="22" cy="16" r="3" style="fill:var(--glow,none)"/><circle cx="46" cy="18" r="3" style="fill:var(--glow,none)"/><circle cx="92" cy="18" r="3" style="fill:var(--glow,none)"/><circle cx="118" cy="15" r="3" style="fill:var(--glow,none)"/>',
  jardim:
    '<path d="M40 86 V58"/><circle cx="40" cy="40" r="18"/><path d="M60 86 a12 10 0 0 1 24 0 a10 8 0 0 1 20 0"/><path d="M122 86 V54 M114 44 h16"/><rect x="116" y="44" width="12" height="10" rx="2" style="fill:var(--glow,none)"/><path d="M4 86 H136"/>',
  piscina:
    '<path d="M6 56 H134"/><path d="M8 68 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 M8 80 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0"/><path d="M96 66 V40 a6 6 0 0 1 12 0 M112 66 V40 a6 6 0 0 1 12 0 M96 48 h16 M96 58 h16"/><circle cx="36" cy="26" r="9" style="fill:var(--glow,none)"/>',
  banheiro:
    '<path d="M118 6 V20 H100 M92 26 a8 8 0 0 1 16 0 z M94 34 v5 M100 36 v5 M106 34 v5"/><circle cx="40" cy="24" r="7" style="fill:var(--glow,none)"/><path d="M12 56 H130 M18 56 v12 a12 12 0 0 0 12 12 h80 a12 12 0 0 0 12 -12 V56 M34 80 l-3 6 M108 80 l3 6"/>',
  lavabo:
    '<rect x="52" y="8" width="36" height="32" rx="14"/><path d="M28 56 H112 M44 56 v4 a26 12 0 0 0 52 0 v-4 M70 56 V48 h10"/><rect x="48" y="70" width="44" height="16" rx="2"/><circle cx="34" cy="22" r="5" style="fill:var(--glow,none)"/><circle cx="106" cy="22" r="5" style="fill:var(--glow,none)"/>',
  lavanderia:
    '<rect x="76" y="36" width="46" height="50" rx="4"/><path d="M76 46 H122"/><circle cx="99" cy="66" r="13"/><circle cx="99" cy="66" r="8"/><circle cx="113" cy="41" r="1.6"/><path d="M6 14 H62 M14 14 v16 h12 v-16 M38 14 l-4 18 h14 l-4 -18"/><rect x="18" y="60" width="28" height="26" rx="3"/><path d="M60 0 V8"/><circle cx="60" cy="13" r="5" style="fill:var(--glow,none)"/>',
  escritorio:
    '<path d="M8 62 H132 M16 62 V86 M124 62 V86"/><rect x="40" y="28" width="48" height="28" rx="3"/><path d="M64 56 v6 M54 62 h20 M114 62 l-10 -18 l10 -12"/><path d="M108 26 l14 4 l-5 11 z" style="fill:var(--glow,none)"/>',
  biblioteca:
    '<rect x="10" y="10" width="64" height="76" rx="2"/><path d="M10 30 H74 M10 50 H74 M10 70 H74"/><path d="M18 30 V14 M24 30 V16 M30 30 V13 M40 30 V17 M48 50 V34 M54 50 V36 M62 50 V33 M20 70 V54 M26 70 V56 M44 70 V55 M52 70 V53"/><rect x="86" y="60" width="32" height="14" rx="5"/><path d="M90 60 V44 a6 6 0 0 1 6 -6 h12 a6 6 0 0 1 6 6 V60 M90 74 v8 M114 74 v8 M130 86 V30"/><path d="M122 30 h16 l-3 -10 h-10 z" style="fill:var(--glow,none)"/>',
  academia:
    '<path d="M26 66 H84 M34 66 V84 M78 66 V84 M26 66 L18 46"/><path d="M14 34 H66"/><rect x="10" y="26" width="6" height="16" rx="1"/><rect x="64" y="26" width="6" height="16" rx="1"/><circle cx="112" cy="74" r="12"/><path d="M104 64 a8 8 0 0 1 16 0"/><path d="M98 0 V10"/><path d="M90 18 a8 8 0 0 1 16 0 z" style="fill:var(--glow,none)"/>',
  adega:
    '<rect x="12" y="16" width="62" height="70" rx="2"/><path d="M12 36 L32 16 M12 56 L52 16 M12 76 L72 16 M32 86 L74 44 M52 86 L74 64"/><path d="M98 86 v-30 l4 -8 v-10 h4 v10 l4 8 v30 z"/><path d="M118 70 h10 l-1 8 a4 4 0 0 1 -8 0 z M123 82 v4"/><path d="M112 0 V14"/><path d="M104 22 a8 8 0 0 1 16 0 z" style="fill:var(--glow,none)"/>',
  brinquedoteca:
    '<rect x="14" y="66" width="20" height="20" rx="2"/><rect x="34" y="66" width="20" height="20" rx="2"/><rect x="24" y="46" width="20" height="20" rx="2"/><circle cx="78" cy="76" r="10"/><path d="M68 76 q10 -6 20 0"/><path d="M96 82 h32 v-8 l-6 -6 h-16 l-6 6 h-4 z"/><circle cx="104" cy="84" r="3"/><circle cx="122" cy="84" r="3"/><path d="M116 8 l3 7 h7 l-6 4 l2 7 l-6 -4 l-6 4 l2 -7 l-6 -4 h7 z" style="fill:var(--glow,none)"/>',
  sauna:
    '<path d="M12 60 H128 M12 74 H128 M18 60 V86 M122 60 V86"/><path d="M28 60 v-10 h16 v10 M44 52 l8 -6"/><path d="M84 48 q4 -6 0 -12 q-4 -6 0 -12 M96 48 q4 -6 0 -12 q-4 -6 0 -12 M108 48 q4 -6 0 -12 q-4 -6 0 -12"/><circle cx="26" cy="22" r="5" style="fill:var(--glow,none)"/>',
  garagem:
    '<path d="M14 70 h112 v-11 l-16 -5 l-14 -15 h-46 l-14 15 l-18 5 z M64 39 v15"/><circle cx="42" cy="72" r="8"/><circle cx="98" cy="72" r="8"/><circle cx="120" cy="62" r="3" style="fill:var(--glow,none)"/><path d="M4 86 H136"/>',
  entrada:
    '<rect x="80" y="12" width="42" height="74" rx="2"/><circle cx="113" cy="52" r="2.2"/><rect x="26" y="24" width="30" height="22" rx="2"/><path d="M64 32 a7 7 0 0 1 14 0 z" style="fill:var(--glow,none)"/><path d="M71 32 v8 M4 86 H136"/>',
  corredor:
    '<path d="M8 90 L52 54 M132 90 L88 54 M52 54 H88 M52 54 V22 M88 54 V22 M8 4 L52 22 M132 4 L88 22 M52 22 H88"/><rect x="62" y="30" width="16" height="24"/><circle cx="36" cy="14" r="3" style="fill:var(--glow,none)"/><circle cx="104" cy="14" r="3" style="fill:var(--glow,none)"/><circle cx="70" cy="22" r="2" style="fill:var(--glow,none)"/>',
  escada:
    '<path d="M14 86 V74 H32 V62 H50 V50 H68 V38 H86 V26 H104"/><path d="M18 60 L100 12 M18 60 V74 M58 36 V50 M100 12 V26"/><path d="M114 44 a7 7 0 0 1 14 0 z" style="fill:var(--glow,none)"/><path d="M121 44 v6"/>',
  deposito:
    '<rect x="18" y="14" width="74" height="72" rx="2"/><path d="M18 38 H92 M18 62 H92"/><rect x="24" y="22" width="20" height="16" rx="1"/><rect x="50" y="26" width="16" height="12" rx="1"/><rect x="26" y="46" width="26" height="16" rx="1"/><rect x="58" y="66" width="28" height="20" rx="1"/><path d="M118 0 V16"/><circle cx="118" cy="22" r="6" style="fill:var(--glow,none)"/>',
  recepcao:
    '<path d="M10 86 V58 H96 V86 M10 58 L16 52 H96"/><rect x="54" y="32" width="28" height="18" rx="2"/><path d="M68 50 v2 M40 0 V14"/><path d="M32 22 a8 8 0 0 1 16 0 z" style="fill:var(--glow,none)"/><path d="M112 86 l-3 -14 h18 l-3 14 M118 72 q-8 -14 -2 -26 M118 72 q8 -12 4 -24"/>',
  espera:
    '<path d="M10 46 V66 H30 V84 M10 66 V84 M36 46 V66 H56 V84 M36 66 V84 M62 46 V66 H82 V84 M62 66 V84"/><path d="M118 86 V36 M110 86 h16"/><path d="M106 36 h24 l-4 -16 h-16 z" style="fill:var(--glow,none)"/><path d="M4 86 H136"/>',
  consultorio:
    '<path d="M8 64 H86 M14 64 V86 M80 64 V86 M30 64 l4 -18 h26 l4 18"/><path d="M68 64 c0 -10 10 -10 10 -2 v2"/><rect x="96" y="58" width="40" height="10" rx="3"/><path d="M96 58 v-7 h12 v7 M102 68 V86 M130 68 V86 M20 64 l6 -16 l10 -6"/><path d="M34 38 l10 4 l-4 8 z" style="fill:var(--glow,none)"/>',
  procedimento:
    '<path d="M26 56 H100 M26 56 L14 40 M100 56 v6 H26 v-6"/><path d="M62 62 V78 M42 86 L62 78 L82 86"/><path d="M128 86 V22 M128 22 q-18 -8 -30 6"/><path d="M86 34 a12 8 0 0 1 24 0 z" style="fill:var(--glow,none)"/><path d="M118 86 h20"/>',
  estetica:
    '<rect x="12" y="58" width="76" height="10" rx="4"/><path d="M12 58 v-6 h16 v6 M22 68 V86 M78 68 V86"/><path d="M96 34 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0 M102 34 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" fill-rule="evenodd" style="fill:var(--glow,none)"/><path d="M112 50 V86 M102 86 h20"/>',
  esterilizacao:
    '<rect x="14" y="40" width="50" height="32" rx="4"/><circle cx="32" cy="56" r="10"/><path d="M52 46 v20 M8 72 H132 M8 72 V86 M132 72 V86 M82 72 v4 a8 8 0 0 0 8 8 h20 a8 8 0 0 0 8 -8 v-4 M100 72 V60 h8"/><rect x="80" y="14" width="44" height="6" rx="3" style="fill:var(--glow,none)"/>',
  laboratorio:
    '<path d="M30 40 V24 h12 V40 l14 30 a4 4 0 0 1 -4 6 h-32 a4 4 0 0 1 -4 -6 z M22 60 h28"/><path d="M60 58 h32 M66 58 V40 M76 58 V40 M86 58 V40"/><path d="M100 86 H132 M116 86 V70 M112 70 l12 -24 M106 76 h16 M120 40 l8 4"/><path d="M70 0 V8"/><circle cx="70" cy="13" r="5" style="fill:var(--glow,none)"/><path d="M4 86 H96"/>',
  salao:
    '<ellipse cx="40" cy="58" rx="22" ry="5"/><path d="M40 63 V84 M30 84 H50 M10 44 V84 M10 66 H20"/><ellipse cx="104" cy="58" rx="22" ry="5"/><path d="M104 63 V84 M94 84 H114 M134 44 V84 M134 66 H124 M40 0 V18 M104 0 V18"/><path d="M30 28 a10 10 0 0 1 20 0 z M94 28 a10 10 0 0 1 20 0 z" style="fill:var(--glow,none)"/>',
  bar:
    '<path d="M8 50 H98 M12 50 V86 M94 50 V86 M8 22 H98"/><path d="M18 22 v-10 h4 v10 M30 22 v-12 h4 v12 M42 22 v-9 h5 v9 M56 22 v-12 h4 v12 M70 22 v-10 h4 v10"/><ellipse cx="118" cy="60" rx="10" ry="3"/><path d="M118 63 V86 M112 76 H124 M30 30 V34 M70 30 V34"/><path d="M24 42 l6 -8 l6 8 z M64 42 l6 -8 l6 8 z" style="fill:var(--glow,none)"/>',
  'cozinha-industrial':
    '<rect x="14" y="50" width="76" height="36" rx="2"/><circle cx="30" cy="58" r="2"/><circle cx="46" cy="58" r="2"/><circle cx="62" cy="58" r="2"/><circle cx="78" cy="58" r="2"/><rect x="24" y="64" width="56" height="18" rx="2"/><path d="M8 30 h92 l-10 -14 h-72 z M44 16 V0 M64 16 V0"/><rect x="22" y="30" width="14" height="3" style="fill:var(--glow,none)"/><rect x="70" y="30" width="14" height="3" style="fill:var(--glow,none)"/><path d="M102 44 H134 M110 44 v-10 h16 v10"/>',
  'camara-fria':
    '<rect x="34" y="12" width="58" height="74" rx="3"/><path d="M80 38 V60 M16 20 V44 M6 26 L26 38 M6 38 L26 26"/><path d="M118 62 V20 a6 6 0 0 1 12 0 V62"/><circle cx="124" cy="72" r="9" style="fill:var(--glow,none)"/>',
  caixa:
    '<path d="M8 60 H96 V86 M8 60 V86"/><rect x="54" y="36" width="30" height="18" rx="2"/><path d="M69 54 v6"/><rect x="26" y="48" width="12" height="12" rx="2"/><path d="M70 0 V14"/><path d="M62 22 a8 8 0 0 1 16 0 z" style="fill:var(--glow,none)"/><path d="M108 86 v-22 h22 v22 M114 64 a5 5 0 0 1 10 0"/>',
  deck:
    '<ellipse cx="54" cy="60" rx="24" ry="5"/><path d="M40 64 V86 M68 64 V86 M54 60 V24 M26 26 Q54 4 82 26 z M14 46 V86 M14 68 H26"/><path d="M88 10 q22 14 46 0"/><circle cx="98" cy="16" r="3" style="fill:var(--glow,none)"/><circle cx="111" cy="17" r="3" style="fill:var(--glow,none)"/><circle cx="124" cy="14" r="3" style="fill:var(--glow,none)"/>',
  'open-space':
    '<path d="M8 66 H132 M14 66 V86 M70 66 V86 M126 66 V86"/><rect x="18" y="44" width="28" height="16" rx="2"/><rect x="56" y="44" width="28" height="16" rx="2"/><rect x="94" y="44" width="28" height="16" rx="2"/><path d="M32 60 v6 M70 60 v6 M108 60 v6 M34 0 V10 M106 0 V10"/><rect x="24" y="10" width="92" height="5" rx="2.5" style="fill:var(--glow,none)"/>',
  reuniao:
    '<path d="M12 64 H128 M20 64 V86 M120 64 V86"/><path d="M30 64 V52 a4 4 0 0 1 8 0 V64 M52 64 V52 a4 4 0 0 1 8 0 V64 M80 64 V52 a4 4 0 0 1 8 0 V64 M102 64 V52 a4 4 0 0 1 8 0 V64"/><rect x="44" y="8" width="52" height="30" rx="2"/><rect x="49" y="13" width="42" height="20" rx="1" style="fill:var(--glow,none)" opacity=".7"/>',
  diretoria:
    '<path d="M8 62 H96 M14 62 V86 M90 62 V86"/><rect x="60" y="62" width="30" height="12"/><path d="M40 62 V38 a8 8 0 0 1 8 -8 h10 a8 8 0 0 1 8 8 V62 M20 62 v-14"/><path d="M14 48 h12 l-2 -9 h-8 z" style="fill:var(--glow,none)"/><path d="M112 86 l-3 -14 h18 l-3 14 M118 72 q-8 -14 -2 -26 M118 72 q8 -12 4 -24"/>',
  auditorio:
    '<rect x="34" y="8" width="72" height="34" rx="2"/><rect x="39" y="13" width="62" height="24" rx="1" style="fill:var(--glow,none)" opacity=".7"/><path d="M8 72 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 M8 86 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0"/>',
  refeitorio:
    '<path d="M10 58 H130 M18 58 V86 M122 58 V86 M14 72 H126"/><rect x="34" y="52" width="16" height="6" rx="1"/><rect x="88" y="52" width="16" height="6" rx="1"/><path d="M36 0 V14 M70 0 V14 M104 0 V14"/><path d="M28 22 a8 8 0 0 1 16 0 z M62 22 a8 8 0 0 1 16 0 z M96 22 a8 8 0 0 1 16 0 z" style="fill:var(--glow,none)"/>',
  loja:
    '<path d="M18 86 V26 M96 86 V26 M14 26 H100 M34 26 v4 M56 26 v4 M78 26 v4"/><path d="M24 30 h20 l3 34 h-26 z M46 30 h20 v44 h-20 z M68 30 h20 l4 30 h-28 z"/><path d="M8 8 H132"/><path d="M36 8 l-5 10 h10 z M84 8 l-5 10 h10 z" style="fill:var(--glow,none)"/><rect x="110" y="60" width="22" height="26" rx="2"/><path d="M116 60 a5 5 0 0 1 10 0"/>',
  vitrine:
    '<rect x="10" y="12" width="120" height="74" rx="2"/><circle cx="70" cy="30" r="6"/><path d="M60 40 h20 l-4 24 h-12 z M70 64 V78 M62 78 H78"/><path d="M110 12 L94 52 H126 Z" style="fill:var(--glow,none)" opacity=".45"/><rect x="104" y="12" width="12" height="5" rx="1" style="fill:var(--glow,none)"/>',
  provador:
    '<path d="M18 14 H90 M22 14 v72 M34 14 q4 36 0 72 M46 14 q4 36 0 72 M58 14 q4 36 0 72 M70 14 q4 36 0 72"/><rect x="100" y="16" width="28" height="62" rx="12"/><path d="M54 0 V4"/><circle cx="54" cy="8" r="4" style="fill:var(--glow,none)"/><path d="M4 86 H136"/>',
  estoque:
    '<rect x="10" y="12" width="82" height="74" rx="2"/><path d="M10 36 H92 M10 60 H92"/><rect x="16" y="20" width="22" height="16"/><rect x="42" y="24" width="18" height="12"/><rect x="64" y="20" width="22" height="16"/><rect x="16" y="44" width="30" height="16"/><rect x="52" y="64" width="34" height="22"/><path d="M110 86 V42 M110 86 h18 M110 52 h12 M122 0 V14"/><circle cx="122" cy="20" r="5" style="fill:var(--glow,none)"/>',
  fachada:
    '<path d="M10 86 V34 H130 V86 M10 34 l6 10 h108 l6 -10"/><rect x="58" y="54" width="24" height="32"/><rect x="18" y="52" width="32" height="24" rx="1"/><rect x="90" y="52" width="32" height="24" rx="1"/><rect x="36" y="10" width="68" height="16" rx="3" style="fill:var(--glow,none)"/><path d="M50 18 h40"/>',
  'salao-beleza':
    '<rect x="22" y="56" width="42" height="10" rx="4"/><path d="M28 56 V30 a6 6 0 0 1 6 -6 h18 a6 6 0 0 1 6 6 V56 M43 66 V76 M29 86 L43 76 L57 86"/><rect x="82" y="10" width="44" height="54" rx="4"/><path d="M76 70 H134"/><circle cx="82" cy="20" r="3" style="fill:var(--glow,none)"/><circle cx="82" cy="37" r="3" style="fill:var(--glow,none)"/><circle cx="82" cy="54" r="3" style="fill:var(--glow,none)"/><circle cx="126" cy="20" r="3" style="fill:var(--glow,none)"/><circle cx="126" cy="37" r="3" style="fill:var(--glow,none)"/><circle cx="126" cy="54" r="3" style="fill:var(--glow,none)"/>',
  'sala-aula':
    '<rect x="20" y="12" width="100" height="38" rx="2"/><path d="M30 24 h40 M30 34 h56 M20 52 H120 M12 70 H50 M18 70 V86 M44 70 V86 M90 70 H128 M96 70 V86 M122 70 V86"/><rect x="40" y="4" width="60" height="3" rx="1.5" style="fill:var(--glow,none)"/>',
  estacionamento:
    '<path d="M8 72 h70 v-8 l-10 -4 l-9 -10 h-28 l-9 10 l-14 4 z"/><circle cx="26" cy="74" r="6"/><circle cx="62" cy="74" r="6"/><rect x="98" y="14" width="26" height="26" rx="4" style="fill:var(--glow,none)"/><path d="M107 34 V21 h6 a4 4 0 0 1 0 8 h-6 M111 40 V86 M4 86 H136"/>',
  palco:
    '<path d="M6 70 H134 M6 70 V86 M134 70 V86 M6 76 H134"/><path d="M70 70 V38"/><circle cx="70" cy="34" r="4"/><path d="M6 4 q12 32 0 66 M134 4 q-12 32 0 66 M40 0 V6 M100 0 V6"/><path d="M34 6 h12 l-2 8 h-8 z M94 6 h12 l-2 8 h-8 z" style="fill:var(--glow,none)"/>',
  'quarto-hotel':
    '<path d="M14 70 V38 a6 6 0 0 1 6 -6 h56 a6 6 0 0 1 6 6 V70"/><rect x="10" y="56" width="76" height="16" rx="5"/><rect x="22" y="46" width="22" height="10" rx="4"/><rect x="52" y="46" width="22" height="10" rx="4"/><path d="M14 72 v9 M82 72 v9"/><rect x="104" y="18" width="24" height="14" rx="2"/><path d="M110 25 h12"/><path d="M98 60 h14 l-3 -10 h-8 z" style="fill:var(--glow,none)"/><path d="M105 60 v12 M98 72 h14 v10 h-14 z"/>',
  casa:
    '<path d="M40 86 V52 L80 22 L120 52 V86 Z"/><rect x="72" y="62" width="16" height="24"/><rect x="50" y="58" width="14" height="12" style="fill:var(--glow,none)"/><rect x="96" y="58" width="14" height="12"/>',
  predio:
    '<rect x="44" y="12" width="60" height="74" rx="2"/><rect x="54" y="22" width="10" height="8"/><rect x="69" y="22" width="10" height="8" style="fill:var(--glow,none)"/><rect x="84" y="22" width="10" height="8"/><rect x="54" y="38" width="10" height="8" style="fill:var(--glow,none)"/><rect x="69" y="38" width="10" height="8"/><rect x="84" y="38" width="10" height="8"/><rect x="54" y="54" width="10" height="8"/><rect x="69" y="54" width="10" height="8"/><rect x="84" y="54" width="10" height="8" style="fill:var(--glow,none)"/><rect x="66" y="70" width="16" height="16"/><path d="M4 86 H136"/>',
};

export function isArtId(value: unknown): value is ArtId {
  return typeof value === 'string' && (ART_IDS as readonly string[]).includes(value);
}
