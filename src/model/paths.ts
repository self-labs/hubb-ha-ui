/** View paths the strategy always creates. An area with one of these ids gets a prefixed path. */
export const FIXED_PATHS: readonly string[] = ['home', 'scenes', 'diagnostico', 'revisar'];

export function roomPath(areaId: string): string {
  return FIXED_PATHS.includes(areaId) ? `area-${areaId}` : areaId;
}
