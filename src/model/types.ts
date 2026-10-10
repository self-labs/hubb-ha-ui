export interface LightItem {
  entityId: string;
  name: string;
  dimmable: boolean;
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
  lights: LightItem[];
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
}

export interface HubbConfig {
  type?: string;
  name?: string;
  scenes?: string[];
  rooms?: Record<string, RoomOverride>;
  hide_entities?: string[];
}
