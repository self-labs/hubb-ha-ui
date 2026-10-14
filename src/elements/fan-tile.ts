import { mdiFan, mdiFanOff } from '@mdi/js';
import { FAN_FEATURE, has } from '../actions/climate';
import type { HomeAssistant } from '../ha/types';
import type { ClimateItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileWords } from './toggle-tile';

const WORDS: TileWords = { on: S.equipmentOn, off: S.equipmentOff, turningOn: S.switchingOn, turningOff: S.switchingOff };

/** A fan: a tap turns it on and off; a long press opens its speeds, when it has them. */
export class HubbFanTile extends HubbToggleTile<ClimateItem> {
  protected words(): TileWords {
    return WORDS;
  }

  protected iconPath(on: boolean): string {
    return on ? mdiFan : mdiFanOff;
  }

  protected send(hass: HomeAssistant, entityId: string, on: boolean): Promise<unknown> {
    return hass.callService('fan', on ? 'turn_on' : 'turn_off', undefined, { entity_id: entityId });
  }

  protected hasSheet(item: ClimateItem): boolean {
    return has(this.hass?.states[item.entityId], FAN_FEATURE.speed);
  }

  protected openSheet(item: ClimateItem): void {
    this.dispatchEvent(new CustomEvent('hubb-open-climate', { detail: { entityId: item.entityId }, bubbles: true, composed: true }));
  }
}

define('hubb-fan-tile', HubbFanTile);
