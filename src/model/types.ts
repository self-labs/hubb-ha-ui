import type { ArtId } from '../art/drawings';

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
  lights: LightItem[];
  /** Only ever switched one by one: bulk actions and undo leave outlets alone. */
  outlets: OutletItem[];
  scenes: SceneItem[];
}

export interface House {
  name: string;
  rooms: Room[];
  scenes: SceneItem[];
  weatherEntityId: string | null;
}

export interface RoomOverride {
  order?: number;
  photo?: string;
  hidden?: boolean;
  /** A drawing id from src/art/drawings.ts; an id it does not know is ignored. */
  art?: string;
}

export interface HubbConfig {
  type?: string;
  name?: string;
  scenes?: string[];
  rooms?: Record<string, RoomOverride>;
  hide_entities?: string[];
}
