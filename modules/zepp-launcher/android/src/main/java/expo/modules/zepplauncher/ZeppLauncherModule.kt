// Module maison : savoir si l'app Zepp est installée et l'ouvrir.
// Aucun appel réseau : on demande seulement à Android de lancer Zepp.

package expo.modules.zepplauncher

import android.content.Context
import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ZeppLauncherModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ZeppLauncher")

    /** Zepp est-elle installée (et visible grâce à la déclaration <queries>) ? */
    Function("isInstalled") {
      launchIntent() != null
    }

    /** Ouvre Zepp. Renvoie false si elle n'est pas installée. */
    Function("open") {
      val intent = launchIntent() ?: return@Function false
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context().startActivity(intent)
      }
      true
    }
  }

  private fun context(): Context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun launchIntent(): Intent? = context().packageManager.getLaunchIntentForPackage(ZEPP_PACKAGE)

  companion object {
    const val ZEPP_PACKAGE = "com.huami.watch.hmwatchmanager"
  }
}
