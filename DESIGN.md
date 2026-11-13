# DESIGN.md – App biohacking

Référence visuelle : les maquettes du lot 1 (canevas « App biohacking – maquettes du lot 1 »). Ce fichier en fixe les règles pour le code. En cas de doute, il fait foi ; s'il doit changer, le modifier ici d'abord.

## Principes
- **Sombre, sobre, orienté données** : fond presque noir, cartes anthracite, peu de couleurs. Inspiration Whoop pour l'ambiance, sans reprendre ses éléments propres (logo, noms, icônes).
- **Une information principale par écran** (sur l'accueil : le score de récupération), le reste en cartes secondaires.
- **La couleur porte un sens, jamais seule** : chaque couleur d'état est accompagnée d'un libellé texte (« Bonne récupération », « reçue », « absente »…).
- **Pas d'emoji, pas de dégradés décoratifs, pas d'ombres.** Icônes en trait fin (2 px), couleur du texte.
- Thème sombre uniquement pour le lot 1 (un thème clair pourra venir plus tard).

## Couleurs (tokens)

| Token | Valeur | Usage |
| --- | --- | --- |
| `bg` | `#0B0F14` | Fond de tous les écrans |
| `surface` | `#151B23` | Cartes, champs secondaires, boutons ronds |
| `surfaceAlt` | `#1C2430` | Piste vide de l'anneau, séparateurs |
| `track` | `#232C38` | Fond des jauges, onglet sélectionné |
| `border` | `#2B3644` | Bordures de champs et de boutons secondaires |
| `text` | `#F2F5F8` | Texte principal, bouton principal (fond) |
| `textMuted` | `#9AA6B4` | Libellés, textes secondaires |
| `textSoft` | `#C9D2DC` | Texte secondaire sur fond teinté |
| `good` | `#3DDC97` | Récupération bonne (score ≥ 67), donnée reçue, valeur favorable |
| `mid` | `#F5B83D` | Récupération moyenne (34–66), à confirmer, valeur sous la plage |
| `low` | `#FF7A6B` | Récupération faible (≤ 33), donnée absente |
| `info` | `#4DA3FF` | Charge d'entraînement, calibration, liens (`#7DB8FF` pour le texte) |

Teintes d'état : la couleur à 14 % d'opacité (`rgba(…, 0.14)`) pour les fonds de pastilles et de la carte « Recommandation du jour ».
Contraste : tout texte doit atteindre 4,5:1 sur son fond (les valeurs ci-dessus le respectent sur `bg` et `surface`).

## Typographie
- **Space Grotesk** (500/600/700) : titres d'écran, chiffres (score, valeurs des indicateurs).
- **Inter** (400/500/600) : tout le reste.
- Polices chargées localement avec `expo-font` (fichiers dans `assets/fonts/`), jamais depuis Internet (l'APK de production n'a pas la permission Internet).

| Rôle | Police | Taille / graisse |
| --- | --- | --- |
| Score de récupération | Space Grotesk | 56 / 700 (« % » en 24, `textMuted`) |
| Valeur principale d'un détail | Space Grotesk | 48 / 700 |
| Titre d'écran | Space Grotesk | 20–22 / 600 |
| Valeur d'indicateur (tuile) | Space Grotesk | 22 / 600 (unité en 13, `textMuted`) |
| Texte important (recommandation) | Inter | 16 / 600 |
| Texte courant | Inter | 13–15 / 400 |
| Libellé de section | Inter | 12 / 500, MAJUSCULES, espacement 0,08 em, `textMuted` |
| Petites mentions | Inter | 11–12 / 400 |

## Espacements et formes
- Marges d'écran : 20 px. Espacement entre blocs : 16–18 px. Grilles de tuiles : 10 px.
- Rayons : cartes 16 px, tuiles 14 px, champs et boutons 12–14 px, pastilles 999 px (pilule), boutons ronds 22 px (44 × 44).
- **Cibles tactiles ≥ 44 px** (boutons, notes 1–5, onglets).

## Composants
- **Anneau de récupération** : diamètre 196 px, épaisseur 14 px, piste `surfaceAlt`, arc dans la couleur d'état proportionnel au score. Au centre : score + « Récupération ». Dessous : pastille d'état (fond teinté, texte coloré, 14/600).
- **Carte « Recommandation du jour »** : fond teinté de la couleur d'état, bordure 1 px de la couleur d'état, libellé de section dans la couleur d'état, phrase d'action en 16/600, justification courte en `textSoft`.
- **Tuile d'indicateur** : carte `surface`, libellé / valeur / écart à la norme (couleur `good` si favorable, `textMuted` si neutre, `mid` si défavorable). Une tuile cliquable ouvre l'écran détail.
- **Jauge** (charge, calibration) : hauteur 8 px, piste `track`, remplissage `info`, bornes en 11 px `textMuted`.
- **Bouton principal** : fond `text`, texte `bg`, 52 px de haut, 15/600. Après validation : fond `good` + « Enregistré ✓ ».
- **Bouton secondaire** : contour `border`, fond transparent, texte `text`.
- **Sélecteur 1 à 5** : 5 boutons égaux de 44 px ; sélectionné = fond `text` / texte `bg` ; sinon contour `border`.
- **Onglets de période (7 j / 30 j / 90 j)** : groupe sur fond `surface`, onglet actif fond `track`.
- **Graphique de tendance** : barres arrondies en haut, `#5C6B7E` par défaut, `mid` pour les valeurs sous la plage, dernière barre (aujourd'hui) en `good` ; plage normale en bande `info` à 10 % avec bords pointillés.
- **Barre de navigation** : 72 px, 4 onglets à terme (Aujourd'hui, Tendances, Sport, Réglages), icône + libellé 11 px, actif en `text`, inactifs en `#8B97A6`. Au lot 1, seulement 2 onglets : Aujourd'hui et Réglages (les autres arrivent avec leur lot).

## Écrans du lot 1
1. **Accueil – récap du matin** : date, titre, accès au diagnostic (bouton rond), anneau + pastille, carte Recommandation, 3 tuiles (HRV, FC au repos, Sommeil), jauge de charge 7 j / 28 j, bouton « Saisir poids et ressenti », navigation.
2. **Détail d'un indicateur** (HRV d'abord, même gabarit pour FC au repos et sommeil) : retour, valeur + pastille d'état + moyenne 7 j, onglets de période, graphique avec plage normale et légende, carte « Ce qui fait ton score de récupération » (contributions +, =, −).
3. **Saisie du matin** : poids (champ numérique, kg), ressentis Énergie / Courbatures / Humeur (1 à 5), note libre facultative, bouton Enregistrer.
4. **Sources de données** : calibration des normes (jauge « n / 28 jours »), carte Helio Strap (dernière synchro, types reçus), carte Suunto (dernier import FIT, nombre de séances, bouton « Importer des FIT »), poids et Suivi macro, bouton « Synchroniser maintenant ».

## États à toujours prévoir
- **Calibration en cours** (< 28 jours) : pas de score coloré ; afficher « Calibration : n / 28 jours » et les valeurs brutes, sans jugement.
- **Donnée manquante** (nuit non synchronisée, Health Connect absent, permission refusée) : message clair et action proposée, jamais une valeur inventée.
- **Valeurs fictives** : uniquement dans les tests et les maquettes, jamais dans l'app livrée.

## Textes
- Français, tutoiement, phrases courtes et actionnables (« Séance lourde OK », « Journée légère : mobilité ou marche »).
- Jamais de vocabulaire de diagnostic médical.
