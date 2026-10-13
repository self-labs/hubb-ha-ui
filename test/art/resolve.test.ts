import { describe, expect, it } from 'vitest';
import { ART_IDS } from '../../src/art/drawings';
import { artFor, artFromIcon, artFromName, KEYWORDS, normalizeName } from '../../src/art/resolve';

describe('normalizeName', () => {
  it('drops accents, case, digits and punctuation', () => {
    expect(normalizeName('Consultório 3')).toBe('consultorio');
    expect(normalizeName('  SUÍTE-Master ')).toBe('suite master');
    expect(normalizeName('Área de Serviço')).toBe('area de servico');
    expect(normalizeName('101')).toBe('');
  });
});

describe('artFromName', () => {
  it.each([
    ['Sala', 'sala'],
    ['Sala de Estar', 'sala'],
    ['Sala de Visitas', 'sala'],
    ['Sala de Jantar', 'jantar'],
    ['Sala de TV', 'tv'],
    ['Quarto', 'quarto'],
    ['Quarto 2', 'quarto'],
    ['Quarto da Frente', 'quarto'],
    ['Suíte Master', 'suite'],
    ['QUARTO DAS CRIANÇAS', 'crianca'],
    ['Quarto de Hóspedes', 'hospedes'],
    ['Cozinha', 'cozinha'],
    ['Cozinha Industrial', 'cozinha-industrial'],
    ['Área Gourmet', 'gourmet'],
    ['Área de Serviço', 'lavanderia'],
    ['Área Externa', 'deck'],
    ['Mesas Externas', 'deck'],
    ['Banheiro da Suíte', 'banheiro'],
    ['Hall de Entrada', 'entrada'],
    ['Home Office', 'escritorio'],
    ['Consultório 3', 'consultorio'],
    ['Sala de Atendimento 1', 'consultorio'],
    ['Recepção', 'recepcao'],
    ['Sala de Espera', 'espera'],
    ['Sala de Procedimento', 'procedimento'],
    ['Salão de Beleza', 'salao-beleza'],
    ['Salão', 'salao'],
    ['Câmara Fria', 'camara-fria'],
    ['Sala de Reunião', 'reuniao'],
    ['Open Space', 'open-space'],
    ['Sala de Aula', 'sala-aula'],
    ['Vinhos', 'adega'],
    ['Bares', 'bar'],
    ['Sala de Reuniões', 'reuniao'],
    ['Balcões', 'bar'],
    ['Salões', 'salao'],
    ['Jardins', 'jardim'],
    ['Garagens', 'garagem'],
    ['Sala de Massagem', 'procedimento'],
    ['Sala de Depilação', 'procedimento'],
    ['Drenagem', 'procedimento'],
    ['Sala Laser', 'estetica'],
    ['Show Room', 'loja'],
    ['Toilette', 'lavabo'],
    ['Cafeteria', 'copa'],
  ])('draws %s as %s', (name, art) => {
    expect(artFromName(name)).toBe(art);
  });

  it('returns null when nothing matches', () => {
    for (const name of ['', '101', 'Área de Lazer', 'Bloco B']) expect(artFromName(name)).toBeNull();
  });

  it('reaches every drawing except the two defaults through some keyword', () => {
    const reached = new Set<string>(KEYWORDS.map(([art]) => art));
    expect(ART_IDS.filter((id) => !reached.has(id))).toEqual(['casa', 'predio']);
  });
});

describe('artFromIcon and artFor', () => {
  it('reads the area icon', () => {
    expect(artFromIcon('mdi:sofa')).toBe('sala');
    expect(artFromIcon('mdi:stove')).toBe('cozinha');
    expect(artFromIcon('mdi:bed')).toBe('quarto');
    expect(artFromIcon('mdi:rocket')).toBeNull();
    expect(artFromIcon('constructor')).toBeNull();
    expect(artFromIcon(null)).toBeNull();
  });

  it('prefers the name to the icon', () => {
    expect(artFor('Cozinha', 'mdi:sofa')).toBe('cozinha');
  });

  it('falls back to the icon, then to the default', () => {
    expect(artFor('Bloco B', 'mdi:bed')).toBe('quarto');
    expect(artFor('Bloco B', null)).toBe('casa');
    expect(artFor('101', undefined, 'predio')).toBe('predio');
  });
});

describe('artFor in each kind of place', () => {
  it('lets the place decide what a generic word alone draws', () => {
    expect(artFor('Sala 3', null, 'predio', { sala: 'consultorio' })).toBe('consultorio');
    expect(artFor('Quarto 12', null, 'predio', { quarto: 'quarto-hotel' })).toBe('quarto-hotel');
    expect(artFor('Salão', null, 'predio', { salao: 'salao-beleza' })).toBe('salao-beleza');
  });

  it('keeps the specific words as they are in any place', () => {
    expect(artFor('Sala de Espera', null, 'predio', { sala: 'consultorio' })).toBe('espera');
    expect(artFor('Recepção', null, 'predio', { sala: 'consultorio' })).toBe('recepcao');
    expect(artFor('Sala', null, 'casa', {})).toBe('sala');
  });

  it('uses the default of the place when nothing matches', () => {
    expect(artFor('Bloco B', null, 'predio', {})).toBe('predio');
  });
});
