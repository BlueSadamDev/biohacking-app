import {
  acceptedModels,
  formatBytes,
  modelForSize,
  hashMatches,
  hasEnoughSpace,
  problemMessage,
  requiredFreeSpace,
  sizeMatches,
} from './coachModel';
import { SETTINGS } from './settings';

// Modèle fictif pour les tests (les vraies valeurs sont dans settings.ts).
const SPEC = { sizeBytes: 1000, sha256: 'ABCDEF0123' };

describe('vérification du fichier du modèle', () => {
  it('demande la taille du fichier plus la marge', () => {
    expect(requiredFreeSpace(SPEC, 500)).toBe(1500);
    expect(requiredFreeSpace()).toBe(SETTINGS.coach.model.sizeBytes + SETTINGS.coach.freeSpaceMarginBytes);
  });

  it("refuse l'import sans assez de place, mais tente si la place est inconnue", () => {
    const need = requiredFreeSpace();
    expect(hasEnoughSpace(need)).toBe(true);
    expect(hasEnoughSpace(need - 1)).toBe(false);
    expect(hasEnoughSpace(null)).toBe(true);
  });

  it('exige la taille exacte', () => {
    expect(sizeMatches(1000, SPEC)).toBe(true);
    expect(sizeMatches(999, SPEC)).toBe(false);
    expect(sizeMatches(null, SPEC)).toBe(false);
    expect(sizeMatches(undefined, SPEC)).toBe(false);
  });

  it("compare l'empreinte sans tenir compte des majuscules ni des espaces", () => {
    expect(hashMatches('abcdef0123', SPEC)).toBe(true);
    expect(hashMatches(' ABCDEF0123\n', SPEC)).toBe(true);
    expect(hashMatches('abcdef0124', SPEC)).toBe(false);
    expect(hashMatches(null, SPEC)).toBe(false);
  });

  it('a une empreinte SHA-256 complète dans les réglages, pour chaque modèle accepté', () => {
    for (const m of acceptedModels()) {
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.fileName.endsWith('.gguf')).toBe(true);
    }
    // Tailles toutes différentes : la taille suffit à reconnaître le modèle avant l'empreinte.
    expect(new Set(acceptedModels().map((m) => m.sizeBytes)).size).toBe(acceptedModels().length);
  });

  it('reconnaît le modèle importé à sa taille exacte', () => {
    expect(modelForSize(SETTINGS.coach.model.sizeBytes)).toBe(SETTINGS.coach.model);
    for (const m of SETTINGS.coach.alternativeModels) expect(modelForSize(m.sizeBytes)).toBe(m);
    expect(modelForSize(123)).toBeNull();
  });

  it('explique chaque refus en français', () => {
    expect(problemMessage('no-space', '500 Mo')).toContain('500 Mo libres');
    expect(problemMessage('wrong-size')).toContain("pas le bon fichier");
    expect(problemMessage('wrong-hash')).toContain('abîmé');
    expect(problemMessage('unreadable')).toContain('pas pu être lu');
  });

  it('affiche les tailles en Mo ou en Go', () => {
    expect(formatBytes(SETTINGS.coach.model.sizeBytes)).toBe('731 Mo');
    expect(formatBytes(1.5e9)).toBe('1,5 Go');
  });
});
