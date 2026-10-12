import { mdiPowerPlug, mdiPowerPlugOutline } from '@mdi/js';
import { setSwitch } from '../actions/switch';
import type { HomeAssistant } from '../ha/types';
import type { OutletItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileWords } from './toggle-tile';

const WORDS: TileWords = { on: S.outletOn, off: S.outletOff, turningOn: S.switchingOn, turningOff: S.switchingOff };

/** An outlet: on and off only. The consumption sheet of the spec comes with the energy module. */
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
}

define('hubb-outlet-tile', HubbOutletTile);
