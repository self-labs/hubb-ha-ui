import type {
  HassArea,
  HassDevice,
  HassEntityRegistryDisplay,
  HassEntityState,
  HassServiceTarget,
  HomeAssistant,
} from '../../src/ha/types';

export interface ServiceCallRecord {
  domain: string;
  service: string;
  data: Record<string, unknown> | undefined;
  target: HassServiceTarget | undefined;
}

export type FakeHass = HomeAssistant & { calls: ServiceCallRecord[] };

export interface FakeEntity {
  entity_id: string;
  state?: string;
  attributes?: Record<string, unknown>;
  area_id?: string | null;
  device_id?: string | null;
  labels?: string[];
  hidden?: boolean;
  entity_category?: 'config' | 'diagnostic' | null;
  name?: string | null;
  last_changed?: string;
}

export interface FakeHassInput {
  areas?: HassArea[];
  devices?: HassDevice[];
  entities?: FakeEntity[];
  user?: { id: string; name: string; is_admin: boolean };
  darkMode?: boolean;
  locationName?: string;
  failService?: boolean;
}

export function area(area_id: string, name: string, picture: string | null = null): HassArea {
  return { area_id, name, picture, icon: null, floor_id: null };
}

export function device(id: string, area_id: string | null, name: string): HassDevice {
  return { id, area_id, name, name_by_user: null };
}

export function makeHass(input: FakeHassInput = {}): FakeHass {
  const states: Record<string, HassEntityState> = {};
  const entities: Record<string, HassEntityRegistryDisplay> = {};
  for (const e of input.entities ?? []) {
    entities[e.entity_id] = {
      entity_id: e.entity_id,
      area_id: e.area_id ?? null,
      device_id: e.device_id ?? null,
      labels: e.labels ?? [],
      hidden: e.hidden ?? false,
      entity_category: e.entity_category ?? null,
      name: e.name ?? null,
    };
    if (e.state !== undefined) {
      states[e.entity_id] = { entity_id: e.entity_id, state: e.state, attributes: e.attributes ?? {}, last_changed: e.last_changed };
    }
  }
  const calls: ServiceCallRecord[] = [];
  return {
    states,
    entities,
    devices: Object.fromEntries((input.devices ?? []).map((d) => [d.id, d])),
    areas: Object.fromEntries((input.areas ?? []).map((a) => [a.area_id, a])),
    user: input.user ?? { id: 'u1', name: 'Ana Souza', is_admin: false },
    themes: { darkMode: input.darkMode ?? true },
    config: { location_name: input.locationName ?? 'Casa' },
    calls,
    callService(domain, service, data, target) {
      calls.push({ domain, service, data, target });
      return input.failService ? Promise.reject(new Error('service failed')) : Promise.resolve();
    },
  };
}

/** A copy of `hass` with one state replaced, the way the frontend hands a new object on every change. */
export function withState(
  hass: FakeHass,
  entityId: string,
  state: string,
  attributes?: Record<string, unknown>,
): FakeHass {
  const prev = hass.states[entityId];
  return {
    ...hass,
    states: {
      ...hass.states,
      [entityId]: { entity_id: entityId, state, attributes: attributes ?? prev?.attributes ?? {} },
    },
  };
}
