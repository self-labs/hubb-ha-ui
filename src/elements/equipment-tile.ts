import { mdiPower } from '@mdi/js';
import { html, type TemplateResult } from 'lit';
import { setSwitch } from '../actions/switch';
import type { HomeAssistant } from '../ha/types';
import type { EquipmentItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileWords } from './toggle-tile';

const WORDS: TileWords = { on: S.equipmentOn, off: S.equipmentOff, turningOn: S.switchingOn, turningOff: S.switchingOff };

/** Equipment: a switch the installer gave the equipment role. On and off, like an outlet, in the masculine. */
export class HubbEquipmentTile extends HubbToggleTile<EquipmentItem> {
  protected words(): TileWords {
    return WORDS;
  }

  protected iconPath(): string {
    return mdiPower;
  }

  protected iconTemplate(item: EquipmentItem, on: boolean): TemplateResult {
    return item.icon ? html`<ha-icon .icon=${item.icon}></ha-icon>` : super.iconTemplate(item, on);
  }

  protected send(hass: HomeAssistant, entityId: string, on: boolean): Promise<unknown> {
    return setSwitch(hass, entityId, on);
  }
}

define('hubb-equipment-tile', HubbEquipmentTile);
