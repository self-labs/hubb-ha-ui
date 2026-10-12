import { mdiLightbulbOn, mdiLightbulbOutline } from '@mdi/js';
import { tileColor } from '../actions/color';
import { brightnessPct, setLight } from '../actions/light';
import type { HassEntityState, HomeAssistant } from '../ha/types';
import type { LightItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileExtras, type TileWords } from './toggle-tile';

const WORDS: TileWords = { on: S.on, off: S.off, turningOn: S.turningOn, turningOff: S.turningOff };

export class HubbLightTile extends HubbToggleTile<LightItem> {
  protected words(): TileWords {
    return WORDS;
  }

  protected iconPath(on: boolean): string {
    return on ? mdiLightbulbOn : mdiLightbulbOutline;
  }

  protected send(hass: HomeAssistant, entityId: string, on: boolean): Promise<unknown> {
    return setLight(hass, entityId, on);
  }

  /** Only a dimmable light has something to open; a slow press on a relay must still toggle it. */
  protected hasSheet(item: LightItem): boolean {
    return item.dimmable;
  }

  protected openSheet(item: LightItem): void {
    this.dispatchEvent(
      new CustomEvent('hubb-open-dimmer', {
        detail: { entityId: item.entityId, name: item.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected extras(item: LightItem, state: HassEntityState): TileExtras {
    return { pct: item.dimmable ? brightnessPct(state) : null, color: tileColor(state) };
  }
}

define('hubb-light-tile', HubbLightTile);
