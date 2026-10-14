/** The slice of the Home Assistant frontend `hass` object that hubb-ha-ui reads. */
export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

/** An entry of `hass.entities`, which comes from `entity_registry/list_for_display` (open to non-admins). */
export interface HassEntityRegistryDisplay {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  labels: string[];
  hidden?: boolean;
  entity_category?: 'config' | 'diagnostic' | null;
  name?: string | null;
  /** The integration that owns the entity (`electrolux_status`, `lg_thinq`...). */
  platform?: string;
  translation_key?: string | null;
}

export interface HassDevice {
  id: string;
  area_id: string | null;
  name: string | null;
  name_by_user: string | null;
}

export interface HassArea {
  area_id: string;
  name: string;
  picture: string | null;
  icon: string | null;
  floor_id?: string | null;
  temperature_entity_id?: string | null;
  humidity_entity_id?: string | null;
}

export interface HassFloor {
  floor_id: string;
  name: string;
  /** Below zero for a basement, 0 for the ground floor; null when the installer left it empty. */
  level: number | null;
}

export interface HassServiceTarget {
  entity_id: string | string[];
}

export interface HomeAssistant {
  states: Record<string, HassEntityState>;
  entities: Record<string, HassEntityRegistryDisplay>;
  devices: Record<string, HassDevice>;
  areas: Record<string, HassArea>;
  floors?: Record<string, HassFloor>;
  user?: { id: string; name: string; is_admin: boolean };
  themes: { darkMode: boolean };
  config: { location_name: string };
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: HassServiceTarget,
  ): Promise<unknown>;
  /** The state as a person reads it, translated by the integration; the real frontend always has it. */
  formatEntityState?(stateObj: HassEntityState, state?: string): string;
  /** A WebSocket command; the real frontend always has it. Saving a dashboard needs an administrator. */
  callWS?<T = unknown>(msg: Record<string, unknown>): Promise<T>;
}
