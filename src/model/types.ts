import type { ArtId } from '../art/drawings';
import type { ApplianceItem } from './appliances';
import type { FloorItem } from './floors';
import type { ProfileId } from './profiles';

export interface LightItem {
  entityId: string;
  name: string;
  dimmable: boolean;
}

/** A `switch` that Home Assistant shows as an outlet ("Mostrar como > Tomada"). */
export interface OutletItem {
  entityId: string;
  name: string;
  /** Its power sensor ("120 W"); missing on dashboards frozen before M4. */
  power?: string | null;
  /** Its energy sensor, for "Hoje" on the consumption sheet. */
  energy?: string | null;
}

/** A `switch` with the equipment role: a pump, a fan, a heater. */
export interface EquipmentItem {
  entityId: string;
  name: string;
  /** An `mdi:*` icon from the configuration; null draws the power icon. */
  icon: string | null;
  power?: string | null;
  energy?: string | null;
}

/** An air conditioner (`climate`) or a fan, in the Clima block. */
export interface ClimateItem {
  entityId: string;
  name: string;
  kind: 'climate' | 'fan';
  /** The modes its sheet offers (`entities.<id>.modes`); missing means every mode the device has. */
  modes?: string[];
  /** The settings under "Mais ajustes" (`entities.<id>.controls`); missing means all it has. */
  controls?: string[];
}

/** A curtain, a blind or an awning. */
export interface CoverItem {
  entityId: string;
  name: string;
}

export interface MediaItem {
  entityId: string;
  name: string;
}

/** What opens the house: a gate (`cover`), a lock, or a pulse relay, button or script with the gate role. */
export interface AccessItem {
  entityId: string;
  name: string;
  kind: 'cover' | 'lock' | 'pulse';
}

/** A `button`, `input_button` or `script` with the action role. */
export interface ActionItem {
  entityId: string;
  name: string;
  icon: string | null;
}

/** A door, a window, a garage door or an opening sensor. */
export type OpeningKind = 'door' | 'window' | 'garage_door' | 'opening';

export interface OpeningItem {
  entityId: string;
  name: string;
  kind: OpeningKind;
  /** Null without a room: then only the security tab lists it. */
  roomName: string | null;
  path: string | null;
}

/** A sensor of a room, shown as a card in its Sensores block and edited like any item. */
export type SensorKind = OpeningKind | 'presence' | 'temperature' | 'humidity';

export interface SensorItem {
  entityId: string;
  name: string;
  kind: SensorKind;
}

/** What lights the red strip: a smoke, gas, carbon monoxide or leak sensor, or an alarm going off. */
export type AlertKind = 'smoke' | 'gas' | 'carbon_monoxide' | 'moisture' | 'alarm';

export interface AlertItem {
  entityId: string;
  kind: AlertKind;
  roomName: string | null;
  /** The room page the strip leads to; null leads to the security tab. */
  path: string | null;
}

export interface CameraItem {
  entityId: string;
  name: string;
  roomName: string | null;
}

export interface AlarmItem {
  entityId: string;
  name: string;
}

/** A gate, lock or pulse relay of a room, listed again on the security tab. */
export interface PlacedAccess extends AccessItem {
  roomName: string;
}

/** What the security tab shows: the house as a whole. */
export interface Security {
  alarms: AlarmItem[];
  cameras: CameraItem[];
  openings: OpeningItem[];
  access: PlacedAccess[];
}

/** What every screen gets from the strategy, whatever room it draws. */
export interface Shared {
  alerts: AlertItem[];
  /** Whether the security tab has anything to show, so the bar offers it. */
  security: boolean;
}

export interface SceneItem {
  entityId: string;
  name: string;
  areaId: string | null;
  /** Rooms a scene touches ("Sala e Quarto"); null for scripts or scenes with no known room. */
  description: string | null;
}

export interface Room {
  areaId: string;
  /** View path: the area id, prefixed when it would clash with a fixed screen. */
  path: string;
  name: string;
  photo: string | null;
  icon: string | null;
  /** The drawing shown on the card and the header when there is no photo. */
  art: ArtId;
  /** A floor id of Home Assistant, after `rooms.<area>.floor`; null when the room has none. */
  floorId: string | null;
  /** Lights, including the `switch` entities given the light role. */
  lights: LightItem[];
  /** Only ever switched one by one: bulk actions and undo leave outlets alone. */
  outlets: OutletItem[];
  /** Switched one by one too, like the outlets. */
  equipment: EquipmentItem[];
  appliances: ApplianceItem[];
  actions: ActionItem[];
  climate: ClimateItem[];
  covers: CoverItem[];
  media: MediaItem[];
  access: AccessItem[];
  scenes: SceneItem[];
  /** What the configuration hides here (the hidden role, hide_entities), for the editor to show again. */
  hidden: HiddenItem[];
  /** Doors and windows of the room; "Janela aberta" while one is on. */
  openings: OpeningItem[];
  /** Motion, occupancy and presence sensors: "Ocupado" while one is on. */
  presence: string[];
  /** The thermometer and the hygrometer of the room, for "24° · 61%". */
  temperature: string | null;
  humidity: string | null;
  /** Every sensor of the room, for its Sensores block: doors, windows, presence, temperature, humidity. */
  sensors: SensorItem[];
}

export interface HiddenItem {
  entityId: string;
  name: string;
}

export interface House {
  name: string;
  profile: ProfileId;
  /** Name of the first tab and of the home view: "Casa" for a home, "Início" elsewhere. */
  homeLabel: string;
  /** The floor tabs; empty unless the rooms shown sit on two or more floors. */
  floors: FloorItem[];
  rooms: Room[];
  /** Rooms hidden with rooms.<area>.hidden, for the editor to show again. */
  hiddenRooms: { areaId: string; name: string }[];
  scenes: SceneItem[];
  weatherEntityId: string | null;
  alerts: AlertItem[];
  security: Security;
  /** Rooms with only sensors: not on the home, but their page shows them when an alert leads there. */
  sensorRooms: Room[];
}

export interface RoomOverride {
  order?: number;
  photo?: string;
  hidden?: boolean;
  /** A drawing id from src/art/drawings.ts; an id it does not know is ignored. */
  art?: string;
  /** A floor id of Home Assistant, to place the room on another floor without touching HA. */
  floor?: string;
}

/** What the YAML says about one entity, before `readConfig` checks it. */
export interface EntityConfig {
  role?: string;
  name?: string;
  icon?: string;
  area?: string;
  hide?: string[];
  remaining?: string;
  progress?: string;
  /** The power and energy sensors of an outlet or equipment, when the panel cannot match them. */
  power?: string;
  energy?: string;
  /** An air conditioner: the modes and the settings its sheet offers. */
  modes?: string[];
  controls?: string[];
  /** Place inside its block: lower first; items with none come after, by name. */
  order?: number;
}

export interface HubbConfig {
  type?: string;
  name?: string;
  /** One of the eight places of src/model/profiles.ts; `home` when missing. */
  profile?: string;
  scenes?: string[];
  rooms?: Record<string, RoomOverride>;
  entities?: Record<string, EntityConfig>;
  hide_entities?: string[];
}
