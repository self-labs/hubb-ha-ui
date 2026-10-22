import type { HassEntityState } from '../ha/types';
import type { MediaView } from '../model/media';
import { MEDIA, S } from '../strings';

/** Features of a `media_player` (MediaPlayerEntityFeature). */
export const MEDIA_FEATURE = {
  pause: 1,
  seek: 2,
  volumeSet: 4,
  mute: 8,
  previous: 16,
  next: 32,
  turnOn: 128,
  turnOff: 256,
  volumeStep: 1024,
  source: 2048,
  play: 16384,
  shuffle: 32768,
  soundMode: 65536,
  repeat: 262144,
  grouping: 524288,
} as const;

/**
 * What a player is doing, in words: "Jornal · Banda", "Pausado", "Desligado". Playing, it says what
 * plays and not that it plays: the card already shows it (the pause button, the bars), and "Tocando"
 * only stays when there is nothing else to say. The music comes from the view (the speaker, filled in
 * by the Spotify playing on it); the rest from its state.
 */
export function mediaLine(view: MediaView, st: HassEntityState | undefined): string {
  if (!st || st.state === 'unavailable') return S.noResponse;
  // An infrared TV before its first command: there is nothing true to say.
  if (st.state === 'unknown') return '';
  const a = st.attributes;
  const what = [view.title, a.app_name, a.source].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (st.state === 'playing') {
    if (!what) return MEDIA.playing;
    return view.title && view.artist ? `${view.title} · ${view.artist}` : what;
  }
  if (st.state === 'paused') return MEDIA.paused;
  if (st.state === 'off' || st.state === 'standby') return MEDIA.off;
  return typeof a.source === 'string' && a.source ? `${MEDIA.on} · ${a.source}` : MEDIA.on;
}

/** A channel option of the WiiM select in the words of the house; an unknown one as it comes. */
export function channelWord(option: string): string {
  return option === 'Stereo' ? MEDIA.stereo : option === 'Left' ? MEDIA.left : option === 'Right' ? MEDIA.right : option;
}
