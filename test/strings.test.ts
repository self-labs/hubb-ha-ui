import { describe, expect, it } from 'vitest';
import { greeting, joinPt, lightsCount, roomStatus, roomTurnedOff } from '../src/strings';

describe('strings', () => {
  it('joins names the Portuguese way', () => {
    expect(joinPt([])).toBe('');
    expect(joinPt(['Sala'])).toBe('Sala');
    expect(joinPt(['Sala', 'Quarto'])).toBe('Sala e Quarto');
    expect(joinPt(['Sala', 'Quarto', 'Cozinha'])).toBe('Sala, Quarto e Cozinha');
  });

  it('counts lights in singular and plural', () => {
    expect(lightsCount(1)).toBe('1 luz acesa');
    expect(lightsCount(3)).toBe('3 luzes acesas');
  });

  it('describes a room status and a room switched off', () => {
    expect(roomStatus(0, 7)).toBe('Tudo apagado');
    expect(roomStatus(2, 7)).toBe('2 de 7 luzes acesas');
    expect(roomStatus(1, 1)).toBe('1 de 1 luz acesa');
    expect(roomTurnedOff('Sala', 2)).toBe('Sala: 2 luzes apagadas');
  });

  it('greets by the time of day', () => {
    expect(greeting(6)).toBe('Bom dia');
    expect(greeting(13)).toBe('Boa tarde');
    expect(greeting(19)).toBe('Boa noite');
    expect(greeting(2)).toBe('Boa noite');
  });
});
