import { mdiPower } from '@mdi/js';
import { html, type TemplateResult } from 'lit';
import { watts } from '../actions/energy';
import { setSwitch } from '../actions/switch';
import type { HomeAssistant } from '../ha/types';
import type { EquipmentItem } from '../model/types';
import { S } from '../strings';
import { define } from './define';
import { HubbToggleTile, type TileExtras, type TileWords } from './toggle-tile';

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

  /** The power now, after "Ligada": "Ligada · 120 W". */
  protected extras(item: EquipmentItem): TileExtras {
    return { pct: null, color: null, detail: this.hass ? watts(this.hass, item.power) : null };
  }

  /** With a power or energy sensor, a long press opens the consumption sheet. */
  protected hasSheet(item: EquipmentItem): boolean {
    return !!(item.power || item.energy);
  }

  protected openSheet(item: EquipmentItem): void {
    this.dispatchEvent(new CustomEvent('hubb-open-power', { detail: { entityId: item.entityId }, bubbles: true, composed: true }));
  }
}

define('hubb-equipment-tile', HubbEquipmentTile);
