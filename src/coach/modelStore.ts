// Coach IA (lot 4, étape C1) : installation du fichier du modèle dans l'espace privé de l'app.
// Import manuel uniquement (sélecteur de fichiers d'Android) : l'app ne télécharge jamais rien.
// Vérifications : place libre, taille exacte, puis empreinte SHA-256 (calcul natif, sans Internet).

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import {
  acceptedModels,
  hasEnoughSpace,
  hashMatches,
  modelForSize,
  sizeMatches,
  type CoachModelSpec,
  type ModelProblem,
} from '@/domain/coachModel';

export type InstalledModel = { name: string; label: string; sizeBytes: number; uri: string };

export type ImportResult =
  | { kind: 'canceled' }
  | { kind: 'installed'; model: InstalledModel }
  | { kind: 'refused'; problem: ModelProblem };

/** Étapes affichées pendant l'import. */
export type ImportStep = 'verifying' | 'installing';

function modelDir(): Directory {
  const dir = new Directory(Paths.document, 'coach');
  if (!dir.exists) dir.create();
  return dir;
}

function modelFile(spec: CoachModelSpec): File {
  return new File(modelDir(), spec.fileName);
}

/** Place libre sur le téléphone (octets), ou null si Android ne la donne pas. */
export function availableSpace(): number | null {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

/** Modèle installé (fichier d'un modèle accepté, présent et de la bonne taille), ou null. */
export function getInstalledModel(): InstalledModel | null {
  try {
    for (const spec of acceptedModels()) {
      const file = modelFile(spec);
      if (file.exists && sizeMatches(file.size, spec)) {
        return { name: file.name, label: spec.label, sizeBytes: file.size ?? 0, uri: file.uri };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // fichier temporaire : tant pis s'il reste, le cache est vidé par Android
  }
}

/**
 * Demande le fichier à l'utilisateur, le vérifie puis l'installe.
 * Le fichier refusé (ou sa copie temporaire) est supprimé : rien de douteux n'est gardé.
 */
export async function importModel(onStep: (step: ImportStep) => void): Promise<ImportResult> {
  // Place nécessaire : celle du plus gros modèle accepté (le fichier choisi n'est pas encore connu).
  const biggest = acceptedModels().reduce((a, b) => (b.sizeBytes > a.sizeBytes ? b : a));
  if (!hasEnoughSpace(availableSpace(), biggest)) return { kind: 'refused', problem: 'no-space' };

  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return { kind: 'canceled' };

  const temp = new File(picked.assets[0].uri);
  try {
    const spec = modelForSize(temp.size);
    if (!spec) {
      deleteQuietly(temp);
      return { kind: 'refused', problem: 'wrong-size' };
    }
    onStep('verifying');
    const hash = await temp.digest('SHA-256');
    if (!hashMatches(hash, spec)) {
      deleteQuietly(temp);
      return { kind: 'refused', problem: 'wrong-hash' };
    }
    onStep('installing');
    // Un seul modèle à la fois : l'ancien (même s'il s'agit d'un autre modèle) est supprimé.
    for (const other of acceptedModels()) deleteQuietly(modelFile(other));
    const target = modelFile(spec);
    await temp.move(target);
    const model = getInstalledModel();
    return model ? { kind: 'installed', model } : { kind: 'refused', problem: 'unreadable' };
  } catch {
    deleteQuietly(temp);
    return { kind: 'refused', problem: 'unreadable' };
  }
}

/** Supprime le modèle installé (et tout le dossier du coach). */
export function deleteModel(): void {
  const dir = new Directory(Paths.document, 'coach');
  if (dir.exists) dir.delete();
}
