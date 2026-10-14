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
}

/** A `switch` with the equipment role: a pump, a fan, a heater. */
export interface EquipmentItem {
  entityId: string;
  name: string;
  /** An `mdi:*` icon from the configuration; null draws the power icon. */
  icon: string | null;
}

/** A `button`, `input_button` or `script` with the action role. */
export interface ActionItem {
  entityId: string;
  name: string;
  icon: string | null;
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
  scenes: SceneItem[];
  /** What the configuration hides here (the hidden role, hide_entities), for the editor to show again. */
  hidden: HiddenItem[];
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
