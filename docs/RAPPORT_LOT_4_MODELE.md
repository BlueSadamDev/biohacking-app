# Rapport du lot 4 – Choix du moteur et du modèle du coach

Statut : **en cours** (recherche faite le 14 novembre 2026 ; mesures sur le téléphone à venir).

Ce rapport ne contient que des informations techniques et des mesures faites sur des **données fictives**. Aucune donnée de santé réelle.

## 1. Contraintes

- Téléphone : Samsung Galaxy S21 5G, 8 Go de RAM, pas de Gemini Nano.
- 100 % local : aucun appel réseau, APK de production sans permission Internet.
- Modèle ouvert d'environ 1 à 1,5 milliard de paramètres, quantifié, fichier d'environ 1 Go, importé à la main.
- Projet : Expo SDK 58, React Native 0.88, nouvelle architecture, `react-native-worklets` 0.13.0.

## 2. Moteurs comparés

| Critère | llama.rn | react-native-executorch |
| --- | --- | --- |
| Version | 0.12.9 (stable, août 2026) ; 0.13.0-rc.11 (version d'essai, novembre 2026) | 0.11.0 (stable, octobre 2026) |
| Format des modèles | GGUF : un seul fichier, des milliers de modèles disponibles | `.pte` : modèle + 2 fichiers de tokenizer, seulement les modèles convertis par l'éditeur (Llama 3.2, Qwen 2.5 / 3 / 3.5, LFM2.5, SmolLM2, Phi-4 Mini…) |
| Compatibilité avec le projet | Aucune exigence de version déclarée ; plugin Expo fourni | `react-native-worklets` de 0.10 à 0.13 : notre 0.13.0 convient |
| Dépendances ajoutées | Aucune | `react-native-blob-util` (obligatoire, sert aux téléchargements), adaptateur Expo + `expo-asset`, `react-native-device-info` |
| Réseau | Aucun code de téléchargement | Contient du code de téléchargement, inutilisé si on donne un chemin local ; bloqué de toute façon en production (pas de permission Internet) |
| Import manuel | 1 fichier à choisir | 3 fichiers à choisir |

**Première lecture** : llama.rn colle mieux aux règles du projet (un seul fichier, aucune dépendance réseau, choix de modèles libre).

**Décision (15 novembre 2026)** : pour alléger le test, ExecuTorch est écarté sur dossier, sans mesure sur le téléphone. En plus des points ci-dessus, son installation a montré que `react-native-blob-util` ajoute des permissions réseau (à bloquer) et que la bibliothèque contient une télémétrie, active par défaut lors des téléchargements de modèles (coupée dans le banc d'essai). Il sera retiré du code après le choix du modèle.

## 3. Modèles candidats

| Modèle | Taille | Français | Licence (usage personnel) | Disponible pour |
| --- | --- | --- | --- | --- |
| Llama 3.2 1B Instruct (Meta) | 1,2 Md | Langue officiellement prise en charge ; légèrement devant Qwen 2.5 1.5B au banc d'essai français COLE | Llama 3.2 Community License : usage personnel autorisé. La restriction européenne ne vise que les modèles multimodaux (images), pas ce modèle texte | llama.rn et ExecuTorch |
| Qwen 2.5 1.5B Instruct (Alibaba) | 1,5 Md | Bon, multilingue | Apache 2.0 : libre | llama.rn et ExecuTorch |
| LFM2.5 1.2B Instruct (Liquid AI) | 1,2 Md | Français pris en charge officiellement ; conçu pour les téléphones | LFM Open License v1.0 : libre sauf pour les entreprises de plus de 10 M$ de chiffre d'affaires | llama.rn et ExecuTorch |

Écartés :
- **Gemma 3 1B** : licence propre à Google et aucune donnée sur son français à cette taille.
- **Gemma 4 E2B** et **Qwen 3.5 2B** : trop gros pour la cible (fichiers de 1,3 à 3 Go).
- **Qwen 3.5 0.8B** : en dessous de la taille visée.

**Retenus pour le test (15 novembre 2026)** : 2 modèles seulement, avec llama.rn, en quantification Q4_K_M :
- Llama 3.2 1B Instruct (`Llama-3.2-1B-Instruct-Q4_K_M.gguf`, 808 Mo) : le seul candidat avec un résultat publié en français ;
- LFM2.5 1.2B Instruct (`LFM2.5-1.2B-Instruct-Q4_K_M.gguf`, 731 Mo) : le plus léger, conçu pour les téléphones.

Qwen 2.5 1.5B est mis de côté : c'est le plus gros fichier (1,1 Go), donc probablement le plus lent.

Piste de secours si le français déçoit : **Luth-LFM2-1.2B**, une version de LFM2 spécialement entraînée en français (publiée à EACL 2026, licence LFM 1.0, disponible en GGUF pour llama.rn).

Les tailles et licences sont à reconfirmer sur la fiche officielle de chaque modèle au moment du téléchargement.

## 4. Mesures sur le S21

À venir : mémoire utilisée, temps de chargement, vitesse (mots / s) et qualité sur 3 demandes types en français (bilan de semaine, « Pourquoi ? » d'une alerte, question libre), avec des données fictives.

Méthode : écran temporaire « Banc d'essai du coach » (ouvert depuis le diagnostic) dans l'APK de développement. Réglages communs : contexte de 4 096 jetons, 4 fils de calcul, processeur seul (le GPU Mali du S21 n'est pas pris en charge par l'accélération OpenCL de llama.rn), température 0,3, au plus 300 jetons par réponse. La mémoire est celle de toute l'app (PSS Android). Le banc signale aussi les nombres de la réponse absents du résumé fictif (indice de chiffre inventé).

## 5. Recommandation

À venir, après les mesures.

## Sources

- npm : `llama.rn`, `react-native-executorch`, `react-native-executorch-expo-resource-fetcher` (versions et dépendances déclarées, consultées le 14 novembre 2026)
- [Documentation react-native-executorch : prise en main](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) et [chargement des modèles](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/loading-models)
- [Dépôt llama.rn](https://github.com/mybigday/llama.rn)
- [COLE, banc d'essai de compréhension du français](https://arxiv.org/pdf/2510.05046)
- [Luth : spécialisation française des petits modèles](https://arxiv.org/abs/2510.05846v2) et [Luth-LFM2-1.2B-GGUF](https://huggingface.co/kurakurai/Luth-LFM2-1.2B-GGUF)
- [FAQ Llama (restriction UE limitée aux modèles multimodaux)](https://www.llama.com/faq/)
- [Fiche LFM2.5 1.2B Instruct](https://huggingface.co/litert-community/LFM2.5-1.2B-Instruct)
- [Qwen 3.5 2B](https://huggingface.co/Qwen/Qwen3.5-2B), [Gemma 4 sous licence Apache 2.0](https://the-decoder.com/googles-gemma-4-is-now-available-with-apache-2-0-licensing-for-the-first-time/)
