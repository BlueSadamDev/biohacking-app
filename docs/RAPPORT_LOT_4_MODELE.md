# Rapport du lot 4 – Choix du moteur et du modèle du coach

Statut : **mesures faites** le 15 novembre 2026 ; choix du modèle en attente de l'utilisateur.

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

Méthode : écran temporaire « Banc d'essai du coach » (ouvert depuis le diagnostic) dans l'APK de développement. Réglages communs : contexte de 4 096 jetons, 4 fils de calcul, processeur seul (le GPU Mali du S21 n'est pas pris en charge par l'accélération OpenCL de llama.rn), température 0,3, au plus 300 jetons par réponse. La mémoire est celle de toute l'app (PSS Android). Le banc signale aussi les nombres de la réponse absents du résumé fictif (indice de chiffre inventé).

Connexion : par câble USB (`adb reverse tcp:8081 tcp:8081`), le Wi-Fi de l'ordinateur étant classé « Public » par Windows.

### Vitesse

| Mesure | Llama 3.2 1B | LFM2.5 1.2B |
| --- | --- | --- |
| Chargement du modèle | 5,5 s | 4,6 s |
| Écriture (bilan / pourquoi / question) | 7,5 / 13,4 / 21,5 mots/s | 17,6 / 18,5 / 14,9 mots/s |
| Écriture, en jetons | 11,5 à 21,5 jetons/s | 24 à 27 jetons/s |
| Lecture du résumé, 1re demande | 12,8 s | 8,4 s |
| Lecture du résumé, demandes suivantes | 0,7 à 1,0 s | 0,4 à 8,6 s |
| Durée totale du bilan | 26,6 s | 13,1 s |

Les réponses courtes de Llama (« Je ne sais pas. ») faussent sa vitesse sur les demandes 2 et 3 : la mesure utile est celle du bilan. La lecture des demandes suivantes est plus rapide quand llama.rn réutilise le début commun (consignes et résumé) gardé en mémoire.

**Mémoire** : 579 Mo (Llama) et 587 Mo (LFM2.5), identiques avant et après le chargement. La mesure (PSS du processus) ne compte manifestement pas le fichier du modèle, lu directement sur le stockage (« mmap ») : **chiffre non fiable**, à ne pas utiliser. Aucun des deux modèles n'a fermé l'app.

### Qualité (données fictives)

Aucun nombre absent du résumé dans les 6 réponses.

- **Llama 3.2 1B** :
  - bilan structuré, mais il mélange les chiffres (« jours sous 40 » attribué au sommeil alors que c'est le score de récupération ; « écart de coucher inférieur à 95 » alors qu'il vaut 95) ;
  - affirmation sans appui (« les séances de force ont été très efficaces ») et faute de français (« écartes ») ;
  - « Pourquoi ? » et question libre : simple « Je ne sais pas », alors que l'information était dans le résumé.
- **LFM2.5 1.2B** :
  - français fluide, tutoiement respecté, réponses aux 3 demandes ;
  - « Pourquoi ? » correct (charge en hausse, séance légère ou de mobilité demain) ;
  - mais réponses vagues, sans aucun chiffre, et deux erreurs de sens : « progression en récupération » (le score baisse, 58 contre 66) et « bonne nutrition en protéines » (1,5 g/kg pour une cible de 1,8, sous la cible 4 jours sur 7) ;
  - formules parasites (« Qu'dis-tu ? »).

**Leçon pour la suite** : la vérification des nombres ne suffit pas. Un nombre peut exister dans le résumé et être mal utilisé. Le résumé (étape C2) devra être écrit pour un petit modèle : des phrases courtes avec le verdict déjà calculé par l'app (« Protéines : sous la cible, 4 jours sur 7 ») plutôt que des noms de champs (`ecart_coucher_min`). Les consignes (étape C3) devront demander de citer ces verdicts.

## 5. Recommandation

**LFM2.5 1.2B avec llama.rn**, pour 3 raisons :
1. **Deux fois plus rapide** : un bilan en 13 s au lieu de 27 s, environ 17 mots/s.
2. **Utilisable sur les 3 usages** : Llama refuse 2 demandes sur 3.
3. **Meilleur français**, et le fichier le plus léger (731 Mo).

Ses erreurs de sens sont réelles. Elles se traitent par un résumé plus explicite (C2) et par les garde-fous (C3), et seront revérifiées sur le vrai résumé. Licence LFM Open License v1.0 : usage personnel autorisé.

Si le français reste insuffisant après C2 et C3 : essayer Luth-LFM2-1.2B, la version de LFM2 entraînée en français, même moteur, sans changement de code.

## Sources

- npm : `llama.rn`, `react-native-executorch`, `react-native-executorch-expo-resource-fetcher` (versions et dépendances déclarées, consultées le 14 novembre 2026)
- [Documentation react-native-executorch : prise en main](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) et [chargement des modèles](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/loading-models)
- [Dépôt llama.rn](https://github.com/mybigday/llama.rn)
- [COLE, banc d'essai de compréhension du français](https://arxiv.org/pdf/2510.05046)
- [Luth : spécialisation française des petits modèles](https://arxiv.org/abs/2510.05846v2) et [Luth-LFM2-1.2B-GGUF](https://huggingface.co/kurakurai/Luth-LFM2-1.2B-GGUF)
- [FAQ Llama (restriction UE limitée aux modèles multimodaux)](https://www.llama.com/faq/)
- [Fiche LFM2.5 1.2B Instruct](https://huggingface.co/litert-community/LFM2.5-1.2B-Instruct)
- [Qwen 3.5 2B](https://huggingface.co/Qwen/Qwen3.5-2B), [Gemma 4 sous licence Apache 2.0](https://the-decoder.com/googles-gemma-4-is-now-available-with-apache-2-0-licensing-for-the-first-time/)
