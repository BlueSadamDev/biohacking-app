import { at } from './__fixtures__/nights';
import { localDateTime, toCsv } from './csv';

describe('export CSV', () => {
  it('séparateur « ; », virgule décimale, une ligne par enregistrement', () => {
    const csv = toCsv([
      { id: 'a', kg: 78.4 },
      { id: 'b', kg: 80 },
    ]);
    expect(csv).toBe('id;kg\r\na;78,4\r\nb;80\r\n');
  });

  it('ajoute une colonne de date lisible après chaque colonne « _ms »', () => {
    const time = at(2026, 1, 10, 7, 30);
    expect(toCsv([{ time_ms: time, bpm: 55 }])).toBe(`time_ms;time_date;bpm\r\n${time};2026-01-10 07:30:00;55\r\n`);
    expect(localDateTime(time)).toBe('2026-01-10 07:30:00');
  });

  it('valeur absente = cellule vide (jamais 0)', () => {
    expect(toCsv([{ id: 'a', protein_g: null }])).toBe('id;protein_g\r\na;\r\n');
  });

  it('met entre guillemets le texte qui contient « ; », des guillemets ou un retour à la ligne', () => {
    expect(toCsv([{ note: 'dur; très "dur"\nvraiment' }])).toBe('note\r\n"dur; très ""dur""\nvraiment"\r\n');
  });

  it('table vide : en-tête seul si les colonnes sont connues, sinon rien', () => {
    expect(toCsv([], ['id', 'kg'])).toBe('id;kg\r\n');
    expect(toCsv([])).toBe('');
  });
});
