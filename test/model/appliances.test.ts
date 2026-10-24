import { describe, expect, it } from 'vitest';
import {
  applianceName,
  buttonsFor,
  commandOf,
  findParts,
  isPoweredOff,
  programOf,
  progressPct,
  remainingMinutes,
  situation,
  stateSensorOf,
  stateText,
  type ApplianceParts,
} from '../../src/model/appliances';
import { washerEntities } from '../fixtures/washer';
import { device, makeHass, withState } from '../helpers/fake-hass';

const washer = (state = 'Running', minutes = '40') =>
  makeHass({ devices: [device('d_lavadora', 'terraco', 'Lavadora')], entities: washerEntities('d_lavadora', state, minutes) });

describe('findParts', () => {
  it('finds the state, the time to end, the commands, the choices and the options of the device', () => {
    const parts = findParts(washer(), 'd_lavadora', 'sensor.lavadora_appliancestate');
    expect(parts.state).toBe('sensor.lavadora_appliancestate');
    expect(parts.remaining).toBe('sensor.lavadora_timetoend');
    expect(parts.progress).toBeNull();
    expect(parts.buttons.map((b) => b.command)).toEqual(['off', 'on', 'pause', 'resume', 'start', 'stop']);
    expect(parts.selects).toEqual(['select.lavadora_defaultextrarinse', 'select.lavadora_programid', 'select.lavadora_washlevel']);
    expect(parts.switches).toEqual(['switch.lavadora_rinse', 'switch.lavadora_turboagitation', 'switch.lavadora_turbodrying', 'switch.lavadora_waterreuse']);
  });

  it('leaves out what the configuration hides, and takes its corrections', () => {
    const parts = findParts(washer(), 'd_lavadora', 'switch.lavadora_rinse', {
      hide: ['button.lavadora_executecommand_6'],
      remaining: 'sensor.lavadora_totalcyclecounter',
    });
    expect(parts.state).toBe('sensor.lavadora_appliancestate');
    expect(parts.buttons).toHaveLength(5);
    expect(parts.remaining).toBe('sensor.lavadora_totalcyclecounter');
  });

  it('finds a state sensor by its name; strict means only names that clearly say so', () => {
    const h = makeHass({
      devices: [device('d_ar', 'sala', 'Ar')],
      entities: [
        { entity_id: 'sensor.ar_connectivitystate', device_id: 'd_ar', state: 'Connected' },
        { entity_id: 'sensor.ar_state', device_id: 'd_ar', state: 'Auto' },
      ],
    });
    expect(stateSensorOf(h, 'd_ar')).toBe('sensor.ar_state');
    expect(stateSensorOf(h, 'd_ar', true)).toBeNull();
    expect(stateSensorOf(washer(), 'd_lavadora', true)).toBe('sensor.lavadora_appliancestate');
  });
});

describe('commandOf', () => {
  it('reads the command from the name in English too (the fixture has the Portuguese names)', () => {
    const names = ['Washer OFF', 'ON', 'PAUSE', 'RESUME', 'START', 'STOPRESET', 'Open door'];
    const h = makeHass({ entities: names.map((n, i) => ({ entity_id: `button.b${i}`, state: 'unknown', attributes: { friendly_name: n } })) });
    expect(names.map((_, i) => commandOf(h, `button.b${i}`))).toEqual(['off', 'on', 'pause', 'resume', 'start', 'stop', 'other']);
  });

  it('reads the command from the translation key too, when the name says nothing', () => {
    const h = makeHass({
      entities: [
        { entity_id: 'button.b0', state: 'unknown', attributes: { friendly_name: 'Lavadora Encender' }, translation_key: 'command_on' },
        { entity_id: 'button.b1', state: 'unknown', attributes: { friendly_name: 'Lavadora executeCommand' }, translation_key: 'command_stopreset' },
      ],
    });
    expect([commandOf(h, 'button.b0'), commandOf(h, 'button.b1')]).toEqual(['on', 'stop']);
  });
});

describe('time, progress and situation', () => {
  const parts = (h: ReturnType<typeof washer>): ApplianceParts => findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate');

  it('reads the time left in minutes, whatever the unit', () => {
    const h = washer();
    expect(remainingMinutes(h, parts(h))).toBe(40);
    const seconds = withState(h, 'sensor.lavadora_timetoend', '90', { device_class: 'duration', unit_of_measurement: 's' });
    expect(remainingMinutes(seconds, parts(seconds))).toBe(2);
    const hours = withState(h, 'sensor.lavadora_timetoend', '1.5', { device_class: 'duration', unit_of_measurement: 'h' });
    expect(remainingMinutes(hours, parts(hours))).toBe(90);
    const broken = withState(h, 'sensor.lavadora_timetoend', 'unknown');
    expect(remainingMinutes(broken, parts(broken))).toBeNull();
  });

  it('reads the progress from a percentage sensor, clamped', () => {
    const h = washer();
    expect(progressPct(h, { ...parts(h), progress: null })).toBeNull();
    const with70 = withState(h, 'sensor.lavadora_totalcyclecounter', '170');
    expect(progressPct(with70, { ...parts(with70), progress: 'sensor.lavadora_totalcyclecounter' })).toBe(100);
  });

  it('tells working, paused and stopped apart', () => {
    expect(situation(washer('Running'), parts(washer('Running')))).toBe('working');
    expect(situation(washer('Paused'), parts(washer('Paused')))).toBe('paused');
    expect(situation(washer('Idle', '80'), parts(washer('Idle', '80')))).toBe('stopped');
    // The time to end already shows the length of the chosen program while the washer waits.
    expect(situation(washer('Ready To Start', '80'), parts(washer('Ready To Start', '80')))).toBe('stopped');
    expect(situation(washer('End Of Cycle', '0'), parts(washer('End Of Cycle', '0')))).toBe('stopped');
    expect(situation(washer('Delayed', '30'), parts(washer('Delayed', '30')))).toBe('working');
  });

  it('treats an offline appliance as stopped', () => {
    const h = washer('unavailable', '25');
    expect(situation(h, parts(h))).toBe('stopped');
  });

  it('shows the state as Home Assistant translates it, else in Portuguese when the panel knows the word, else raw', () => {
    const raw = washer();
    expect(stateText(raw, parts(raw), 'Lavadora')).toBe('Lavando');
    const words = (state: string, name: string) => { const h = washer(state); return stateText(h, parts(h), name); };
    expect(['Off', 'Idle', 'Ready To Start', 'Paused', 'Delayed Start', 'End Of Cycle', 'Alarm', 'Rinse Hold'].map((s) => words(s, 'Lavadora'))).toEqual([
      'Desligada', 'Desligada', 'Pronta para iniciar', 'Pausada', 'Início programado', 'Ciclo concluído', 'Alarme', 'Rinse Hold',
    ]);
    expect([words('Running', 'Secadora'), words('Running', 'Lava-louças'), words('RUNNING', 'Forno')]).toEqual(['Secando', 'Lavando', 'Em funcionamento']);
    const pt = makeHass({
      devices: [device('d_lavadora', 'terraco', 'Lavadora')],
      entities: washerEntities(),
      formatEntityState: (st) => (st.state === 'Running' ? 'Lavando' : st.state),
    });
    expect(stateText(pt, parts(pt))).toBe('Lavando');
    expect(stateText(raw, { ...parts(raw), state: null })).toBeNull();
  });
});

describe('names, buttons and program', () => {
  it('names the appliance after its device, or the configuration', () => {
    const h = washer();
    expect(applianceName(h, 'd_lavadora')).toBe('Lavadora');
    expect(applianceName(h, 'd_lavadora', { hide: [], name: 'Máquina' })).toBe('Máquina');
  });

  it('offers the commands that make sense now, and the rest at the end', () => {
    const h = washer();
    const p = findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate');
    const ids = (r: ReturnType<typeof buttonsFor>) => [r.main.map((b) => b.command), r.more.map((b) => b.command)];
    expect(ids(buttonsFor(p, 'stopped'))).toEqual([['start', 'off'], ['stop']]);
    // Switched off, Iniciar alone: it switches the appliance on first (Gustavo, 23/10).
    expect(ids(buttonsFor(p, 'stopped', true))).toEqual([['start'], ['stop']]);
    // Without Iniciar, Ligar stays.
    const noStart = { ...p, buttons: p.buttons.filter((b) => b.command !== 'start') };
    expect(ids(buttonsFor(noStart, 'stopped', true))).toEqual([['on'], ['stop']]);
    expect(ids(buttonsFor(p, 'working'))).toEqual([['pause', 'off'], ['stop']]);
    expect(ids(buttonsFor(p, 'paused'))).toEqual([['resume', 'off'], ['stop']]);
  });

  it('tells a washer that is switched off from one that waits powered on', () => {
    const off = washer('Off', '0');
    expect(isPoweredOff(off, findParts(off, 'd_lavadora', 'sensor.lavadora_appliancestate'))).toBe(true);
    const gone = washer('unavailable', '0');
    expect(isPoweredOff(gone, findParts(gone, 'd_lavadora', 'sensor.lavadora_appliancestate'))).toBe(true);
    // An Electrolux washer says Idle after Desligar and ignores Iniciar until Ligar (Gustavo's house, 22/10).
    const idle = washer('Idle', '80');
    expect(isPoweredOff(idle, findParts(idle, 'd_lavadora', 'sensor.lavadora_appliancestate'))).toBe(true);
    const ready = washer('Ready To Start', '80');
    expect(isPoweredOff(ready, findParts(ready, 'd_lavadora', 'sensor.lavadora_appliancestate'))).toBe(false);
  });

  it('finds the program among the choices', () => {
    const h = washer();
    expect(programOf(findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate'))).toBe('select.lavadora_programid');
  });

  it('applies hide to the state sensor it finds by itself', () => {
    const h = washer();
    expect(findParts(h, 'd_lavadora', 'switch.lavadora_rinse', { hide: ['sensor.lavadora_appliancestate'] }).state).toBeNull();
  });

  it('keeps a clear state sensor even when the device name has a word like link', () => {
    const h = makeHass({
      devices: [device('d_link', 'sala', 'Link')],
      entities: [{ entity_id: 'sensor.link_appliancestate', device_id: 'd_link', state: 'Idle' }],
    });
    expect(stateSensorOf(h, 'd_link', true)).toBe('sensor.link_appliancestate');
  });

  it('puts a second button for the same command among the others, under its own name', () => {
    const h = makeHass({
      devices: [device('d_lavadora', 'terraco', 'Lavadora')],
      entities: [
        ...washerEntities(),
        { entity_id: 'button.lavadora_luz_ligar', device_id: 'd_lavadora', state: 'unknown', attributes: { friendly_name: 'Lavadora Luz ligar' } },
      ],
    });
    const p = findParts(h, 'd_lavadora', 'sensor.lavadora_appliancestate');
    const { main, more } = buttonsFor(p, 'stopped', true);
    expect(main.map((b) => b.entityId)).toEqual(['button.lavadora_executecommand_5']);
    expect(more.map((b) => [b.entityId, b.command])).toEqual([
      ['button.lavadora_executecommand_6', 'stop'],
      ['button.lavadora_luz_ligar', 'other'],
    ]);
  });
});

describe('Electrolux names after the translation keys (upstream PR #235)', () => {
  it('still finds the state and the time left when only the translation key says what they are', () => {
    const h = makeHass({
      devices: [device('d_lav', 'terraco', 'Lavadora')],
      entities: [
        { entity_id: 'sensor.lavadora_estado', device_id: 'd_lav', state: 'Idle', translation_key: 'appliance_state' },
        { entity_id: 'sensor.lavadora_conexao', device_id: 'd_lav', state: 'Connected', translation_key: 'connectivity_state' },
        {
          entity_id: 'sensor.lavadora_tempo',
          device_id: 'd_lav',
          state: '80',
          translation_key: 'time_to_end',
          attributes: { device_class: 'duration', unit_of_measurement: 'min' },
        },
        {
          entity_id: 'sensor.lavadora_inicio',
          device_id: 'd_lav',
          state: '0',
          translation_key: 'start_time',
          attributes: { device_class: 'duration', unit_of_measurement: 'min' },
        },
      ],
    });
    expect(stateSensorOf(h, 'd_lav', true)).toBe('sensor.lavadora_estado');
    const parts = findParts(h, 'd_lav', 'sensor.lavadora_estado');
    expect(parts.remaining).toBe('sensor.lavadora_tempo');
  });
});
