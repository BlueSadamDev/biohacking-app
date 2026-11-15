// Coach IA (lot 4, étape C8) : « gardien » du modèle en mémoire.
// - Un seul modèle chargé à la fois : en charger un nouveau interrompt et libère le précédent.
// - App passée en arrière-plan : la génération en cours s'arrête et le modèle est libéré
//   (aucune génération en arrière-plan, cahier des charges section 6).

import { AppState } from 'react-native';

/** Ce que le gardien sait faire d'un modèle : l'interrompre puis le libérer. */
export type SlotModel = {
  /** Arrêt décidé par l'app (et non par l'utilisateur) : rien n'est enregistré. */
  interrupt(): Promise<void>;
  release(): Promise<void>;
};

export class ModelSlot {
  private current: SlotModel | null = null;

  /** Le modèle actuellement chargé (ou en cours de chargement), s'il y en a un. */
  get active(): SlotModel | null {
    return this.current;
  }

  /** Réserve la place pour `model` : le modèle précédent est interrompu et libéré d'abord. */
  async claim(model: SlotModel): Promise<void> {
    const previous = this.current;
    this.current = model;
    if (previous && previous !== model) await this.shutdown(previous);
  }

  /** `model` a été libéré par son propriétaire : la place se libère (si c'est bien lui qui l'occupe). */
  free(model: SlotModel): void {
    if (this.current === model) this.current = null;
  }

  /** Interrompt et libère le modèle chargé. Renvoie true s'il y en avait un. */
  async evict(): Promise<boolean> {
    const model = this.current;
    this.current = null;
    if (!model) return false;
    await this.shutdown(model);
    return true;
  }

  private async shutdown(model: SlotModel): Promise<void> {
    await model.interrupt().catch(() => undefined);
    await model.release().catch(() => undefined);
  }
}

export const modelSlot = new ModelSlot();

let watching = false;

/** Libère le modèle dès que l'app passe en arrière-plan (branché au premier chargement). */
export function watchAppState(slot: ModelSlot = modelSlot): void {
  if (watching) return;
  watching = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') slot.evict().catch(() => undefined);
  });
}
