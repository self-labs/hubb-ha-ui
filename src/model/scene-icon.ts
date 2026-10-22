import { mdiCreationOutline, mdiDoorOpen, mdiExitRun, mdiMovieOpenOutline, mdiPartyPopper, mdiSilverwareForkKnife, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';

/** Words of a scene name and the drawing they ask for, first match wins (lowercase, no accents). */
const WORDS: readonly [RegExp, string][] = [
  [/\b(chegar|chegada|chegando|entrar|entrada)\b/, mdiDoorOpen],
  [/\b(jantar|almoco|cafe|refeicao)\b/, mdiSilverwareForkKnife],
  [/\b(cinema|filme|tv|televisao|netflix)\b/, mdiMovieOpenOutline],
  [/\b(dormir|noite|deitar)\b/, mdiWeatherNight],
  [/\b(sair|saindo|saida|ausente)\b/, mdiExitRun],
  [/\b(acordar|manha|dia)\b/, mdiWeatherSunny],
  [/\b(festa|receber|visitas)\b/, mdiPartyPopper],
];

/** The drawing of a scene with no icon of its own in Home Assistant, by the words of its name. */
export function sceneIconPath(name: string): string {
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return WORDS.find(([re]) => re.test(plain))?.[1] ?? mdiCreationOutline;
}
