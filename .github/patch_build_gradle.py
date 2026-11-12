"""
Active la signature "release" dans android/app/build.gradle.
Exécuté par le workflow build-apk.yml après `expo prebuild`.
Les propriétés du keystore sont passées par `./gradlew -PBIOHACK_...=...`
(elles-mêmes fournies par les secrets GitHub), jamais écrites dans un fichier.
"""

import re
import sys

BUILD_GRADLE = "android/app/build.gradle"

SIGNING_BLOCKS = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('BIOHACK_STORE_FILE')
                && project.hasProperty('BIOHACK_KEY_ALIAS')
                && project.hasProperty('BIOHACK_STORE_PASSWORD')
                && project.hasProperty('BIOHACK_KEY_PASSWORD')) {
                storeFile file(project.getProperty('BIOHACK_STORE_FILE'))
                storePassword project.getProperty('BIOHACK_STORE_PASSWORD')
                keyAlias project.getProperty('BIOHACK_KEY_ALIAS')
                keyPassword project.getProperty('BIOHACK_KEY_PASSWORD')
            } else {
                throw new GradleException(
                    "ERREUR: les proprietes de signature ne sont pas definies. " +
                    "Verifie que les 4 secrets " +
                    "(ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, " +
                    "ANDROID_KEY_PASSWORD, ANDROID_KEY_ALIAS) sont presents " +
                    "dans Settings > Secrets and variables."
                )
            }
        }
    }"""


def main() -> None:
    with open(BUILD_GRADLE, "r", encoding="utf-8") as f:
        content = f.read()

    # Remplace le bloc signingConfigs existant par un bloc incluant release.
    content, n_signing = re.subn(
        r"signingConfigs \{.*?\n    \}",
        SIGNING_BLOCKS,
        content,
        count=1,
        flags=re.DOTALL,
    )

    # Dans le buildType "release", utilise la signature release à la place
    # de la signature debug (sans toucher au bloc debug).
    content, n_release = re.subn(
        r"(release \{\s*(?://[^\n]*\n\s*)*)signingConfig signingConfigs\.debug",
        r"\1signingConfig signingConfigs.release",
        content,
        count=1,
    )

    if n_signing != 1 or n_release != 1:
        print("ERREUR : structure de build.gradle inattendue, signature non configurée")
        sys.exit(1)

    with open(BUILD_GRADLE, "w", encoding="utf-8") as f:
        f.write(content)

    print("build.gradle modifié pour la signature release")


if __name__ == "__main__":
    main()
