import { AppState } from 'react-native';

import { ModelSlot, watchAppState, type SlotModel } from './modelSlot';

/** Modèle simulé : note ce que le gardien lui fait. */
function fakeModel(name: string, log: string[]): SlotModel {
  return {
    interrupt: async () => {
      log.push(`${name} interrompu`);
    },
    release: async () => {
      log.push(`${name} libéré`);
    },
  };
}

describe('gardien du modèle', () => {
  it('ne garde qu’un modèle à la fois : le précédent est interrompu puis libéré', async () => {
    const slot = new ModelSlot();
    const log: string[] = [];
    const bilan = fakeModel('bilan', log);
    const pourquoi = fakeModel('pourquoi', log);
    await slot.claim(bilan);
    await slot.claim(pourquoi);
    expect(log).toEqual(['bilan interrompu', 'bilan libéré']);
    expect(slot.active).toBe(pourquoi);
  });

  it('libère la place quand le modèle est libéré par son propriétaire', async () => {
    const slot = new ModelSlot();
    const log: string[] = [];
    const a = fakeModel('a', log);
    const b = fakeModel('b', log);
    await slot.claim(a);
    slot.free(b); // un autre modèle ne libère pas la place de a
    expect(slot.active).toBe(a);
    slot.free(a);
    expect(slot.active).toBeNull();
    expect(await slot.evict()).toBe(false);
    expect(log).toEqual([]);
  });

  it('interrompt et libère le modèle quand l’app passe en arrière-plan', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listeners.push(fn as (state: string) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    const slot = new ModelSlot();
    const log: string[] = [];
    await slot.claim(fakeModel('question', log));
    watchAppState(slot);
    watchAppState(slot); // branché une seule fois
    expect(listeners).toHaveLength(1);
    listeners[0]('active');
    expect(log).toEqual([]);
    listeners[0]('background');
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toEqual(['question interrompu', 'question libéré']);
    expect(slot.active).toBeNull();
  });

  it('libère quand même le modèle si son interruption échoue', async () => {
    const slot = new ModelSlot();
    const log: string[] = [];
    await slot.claim({
      interrupt: async () => {
        throw new Error('déjà arrêté');
      },
      release: async () => {
        log.push('libéré');
      },
    });
    expect(await slot.evict()).toBe(true);
    expect(log).toEqual(['libéré']);
  });
});
