import type { HomeAssistant } from '../ha/types';
import { areaOf, coverIsGate } from './classify';
import { displayName } from './names';
import type { HubbConfig } from './types';

/** Where a gate is, as its sensor tells it. */
export type GatePosition = 'open' | 'closed' | 'opening' | 'closing';

const POSITIONS: readonly string[] = ['open', 'closed', 'opening', 'closing'];

/** The door contacts that can tell a gate is open: on means open for them, and a window is never the gate. */
const CONTACT_CLASSES: ReadonlySet<string> = new Set(['door', 'garage_door', 'opening']);

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * A switch that is off again says its pulse ended at its last change: the pulse is read that long
 * before, longer than the pulse itself, so an open whose contact flips during the pulse, or a
 * restart that stamps relay and contact at once, still reads as older than the contact.
 */
const SWITCH_PULSE_MS = 2000;

/** A sensor the editor of a pulse gate offers: a door contact, or a cover that is a gate (switch_as_x). */
export interface GateSensor {
  entityId: string;
  name: string;
}

/**
 * Where the gate is by its sensor: a door contact is on while open; a cover says its position.
 * Null when the sensor does not answer, or is neither of the two.
 */
export function sensorPosition(hass: HomeAssistant, sensorId: string): GatePosition | null {
  const state = hass.states[sensorId]?.state;
  if (state === undefined) return null;
  if (sensorId.startsWith('binary_sensor.')) return state === 'on' ? 'open' : state === 'off' ? 'closed' : null;
  if (sensorId.startsWith('cover.')) return POSITIONS.includes(state) ? (state as GatePosition) : null;
  return null;
}

/**
 * Whether an entity can be the sensor of a gate: a door contact (whose on means open, which the
 * one tap of Fechar relies on) or a cover that is a gate. A motion sensor, a contact with no class
 * or a curtain is not.
 */
export function isGateSensor(hass: HomeAssistant, entityId: string): boolean {
  if (entityId.startsWith('binary_sensor.')) return CONTACT_CLASSES.has(String(hass.states[entityId]?.attributes.device_class ?? ''));
  return entityId.startsWith('cover.') && coverIsGate(hass, entityId);
}

/**
 * When the relay of a pulse gate last fired, by Home Assistant's clock: the press of a button, the
 * last run of a script, the last change of a switch (on during its pulse, off again right after).
 * Null when its state does not say. Every phone reads it, so a pulse from another one is seen too,
 * even by a phone that opens the card after the pulse ended. A relay back from unavailable reads as
 * a pulse too: a wrong wait only takes the tap of Fechar away, a missed one would offer it.
 */
export function relayPulsedAt(hass: HomeAssistant, relayId: string): number | null {
  const st = hass.states[relayId];
  if (!st) return null;
  const domain = relayId.slice(0, relayId.indexOf('.'));
  const at =
    domain === 'button' || domain === 'input_button'
      ? Date.parse(st.state)
      : domain === 'script'
        ? Date.parse(String(st.attributes.last_triggered ?? ''))
        : domain === 'switch' && st.state === 'on'
          ? Date.parse(st.last_changed ?? '')
          : domain === 'switch' && st.state === 'off'
            ? Date.parse(st.last_changed ?? '') - SWITCH_PULSE_MS
            : NaN;
  return Number.isFinite(at) ? at : null;
}

/**
 * What the editor of a pulse gate offers as its sensor: the door contacts and the gates of its room
 * (where `entities.<id>.area` puts them), hidden ones too, since the sensor is often kept off the
 * panel; plus the one chosen, wherever it is. By name.
 */
export function gateSensorCandidates(hass: HomeAssistant, config: HubbConfig, areaId: string, gateId: string): GateSensor[] {
  const entities = config.entities ?? {};
  const chosen = entities[gateId]?.sensor;
  const here = (id: string): boolean => areaOf(hass, id, entities[id]?.area) === areaId;
  const fits = (id: string): boolean => id !== gateId && !!hass.states[id] && (id === chosen || (here(id) && isGateSensor(hass, id)));
  const roomName = hass.areas[areaId]?.name ?? null;
  return Object.keys(hass.entities)
    .filter(fits)
    // One from another room keeps the name of its room: "Porta da sala", not "Porta".
    .map((entityId) => ({ entityId, name: entities[entityId]?.name ?? displayName(hass, entityId, here(entityId) ? roomName : null) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}
