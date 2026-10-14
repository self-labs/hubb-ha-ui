import type { HassEntityState } from '../ha/types';
import { MEDIA, S } from '../strings';

/** Features of a `media_player` (MediaPlayerEntityFeature). */
export const MEDIA_FEATURE = {
  pause: 1,
  volumeSet: 4,
  mute: 8,
  previous: 16,
  next: 32,
  turnOn: 128,
  turnOff: 256,
  volumeStep: 1024,
  source: 2048,
  play: 16384,
} as const;

/** What a player is doing, in words: "Tocando · Jornal", "Pausado", "Desligado". */
export function mediaLine(st: HassEntityState | undefined): string {
  if (!st || st.state === 'unavailable') return S.noResponse;
  // An infrared TV before its first command: there is nothing true to say.
  if (st.state === 'unknown') return '';
  const a = st.attributes;
  const what = [a.media_title, a.app_name, a.source].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (st.state === 'playing') return what ? `${MEDIA.playing} · ${what}` : MEDIA.playing;
  if (st.state === 'paused') return MEDIA.paused;
  if (st.state === 'off' || st.state === 'standby') return MEDIA.off;
  return typeof a.source === 'string' && a.source ? `${MEDIA.on} · ${a.source}` : MEDIA.on;
}
