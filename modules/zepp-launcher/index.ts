// Module maison « zepp-launcher » (Android) : l'app Zepp est-elle installée, et l'ouvrir.
// Absent (ancien APK, autre plateforme) : Zepp est considérée comme non installée.

import { requireOptionalNativeModule } from 'expo';

type ZeppLauncherModule = {
  isInstalled(): boolean;
  open(): boolean;
};

const native = requireOptionalNativeModule<ZeppLauncherModule>('ZeppLauncher');

/** L'app Zepp est-elle installée sur le téléphone ? */
export function isZeppInstalled(): boolean {
  try {
    return native?.isInstalled() ?? false;
  } catch {
    return false;
  }
}

/** Ouvre l'app Zepp. Renvoie false si c'est impossible. */
export function openZepp(): boolean {
  try {
    return native?.open() ?? false;
  } catch {
    return false;
  }
}
