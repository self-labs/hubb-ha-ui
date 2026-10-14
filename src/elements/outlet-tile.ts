import { mdiPowerPlug, mdiPowerPlugOutline } from '@mdi/js';
import { watts } from '../actions/energy';
import { setSwitch } from '../actions/switch';
import type { HomeAssistant } from '../ha/types';
import type { OutletItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileExtras, type TileWords } from './toggle-tile';

const WORDS: TileWords = { on: S.outletOn, off: S.outletOff, turningOn: S.switchingOn, turningOff: S.switchingOff };

/** An outlet: on and off; with a power sensor it says how much it draws and opens its consumption. */
export class HubbOutletTile extends HubbToggleTile<OutletItem> {
  protected words(): TileWords {
    return WORDS;
  }

  protected iconPath(on: boolean): string {
    return on ? mdiPowerPlug : mdiPowerPlugOutline;
  }

  protected send(hass: HomeAssistant, entityId: string, on: boolean): Promise<unknown> {
    return setSwitch(hass, entityId, on);
  }

  /** The power now, after "Ligada": "Ligada · 120 W". */
  protected extras(item: OutletItem): TileExtras {
    return { pct: null, color: null, detail: this.hass ? watts(this.hass, item.power) : null };
  }

  /** With a power or energy sensor, a long press opens the consumption sheet. */
  protected hasSheet(item: OutletItem): boolean {
    return !!(item.power || item.energy);
  }

  protected openSheet(item: OutletItem): void {
    this.dispatchEvent(new CustomEvent('hubb-open-power', { detail: { entityId: item.entityId }, bubbles: true, composed: true }));
  }
}

define('hubb-outlet-tile', HubbOutletTile);
