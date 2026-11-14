# DESIGN.md – Aube

Référence visuelle : les maquettes du lot 1 et la rangée « Aube · identité » du canevas de maquettes. Ce fichier en fixe les règles pour le code. En cas de doute, il fait foi ; s'il doit changer, le modifier ici d'abord.

## Identité
- **Nom affiché** : « Aube » (dans `app.json` : `name`). Le mot-symbole s'écrit en minuscules : **aube**, Space Grotesk 600, espacement des lettres 0,04 em, couleur `text`.
- **Logo (monogramme)** : un « A » en trait épais blanc (`text`), extrémités et angle arrondis, dont la barre horizontale est un horizon ambre (`#F5B83D`) surmonté d'un petit demi-soleil ambre. Dessin de référence (viewBox 0 0 120 120) :
  - jambages : chemin `M24 98 L60 18 L96 98`, trait 12, bouts et jointures arrondis ;
  - soleil : demi-disque de rayon 12 centré en (60, 70) ;
  - horizon : rectangle 48 × 6 en (36, 72), coins arrondis 3.
  - En petit (≤ 48 px) : retirer le soleil, épaissir le trait à 14 et l'horizon à 8 (rectangle 52 × 8 en (34, 70)).
- **Icône Android** : logo centré sur fond `bg` (`#0B0F14`), icône adaptative (avant-plan = logo, arrière-plan = `bg`), le logo occupant environ 60 % de la zone sûre. Générer les fichiers à partir d'un SVG unique rangé dans `assets/brand/`.
- **Écran de démarrage** : fond `bg`, logo 132 px centré, « aube » en 44 px dessous, puis « Ton récap du matin » (15 px, `textMuted`). En bas : barre de progression fine (160 × 4 px) et « Synchronisation de ta nuit… » pendant la synchro Health Connect du lancement.
- **En-tête de l'accueil** : petit logo (18 px, version simplifiée) + « aube » (15 px) + « · date du jour » en `textMuted`, au-dessus du titre « Ton récap du matin ».
- L'ambre du logo est le seul usage non sémantique de `mid` : on ne l'utilise pas ailleurs comme couleur décorative.

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
- **Barre de navigation** : 72 px, 4 onglets (Aujourd'hui, Tendances, Sport, Réglages), icône + libellé 11 px, actif en `text`, inactifs en `#8B97A6`.

## Écrans du lot 1
0. **Démarrage** : voir « Identité ».
1. **Accueil – récap du matin** : en-tête aube + date, titre, accès au diagnostic (bouton rond), anneau + pastille, carte Recommandation, 3 tuiles (HRV, FC au repos, Sommeil), jauge de charge 7 j / 28 j, bouton « Saisir poids et ressenti », navigation.
2. **Détail d'un indicateur** (HRV d'abord, même gabarit pour FC au repos et sommeil) : retour, valeur + pastille d'état + moyenne 7 j, onglets de période, graphique avec plage normale et légende, carte « Ce qui fait ton score de récupération » (contributions +, =, −).
3. **Saisie du matin** : poids (champ numérique, kg), ressentis Énergie / Courbatures / Humeur (1 à 5), note libre facultative, bouton Enregistrer.
4. **Sources de données** : calibration des normes (jauge « n / 28 jours »), carte Helio Strap (dernière synchro, types reçus), carte Suunto (« hors périmètre jusqu'au lot 3 », sans bouton), poids et Suivi macro (via Health Connect), bouton « Synchroniser maintenant ».

## Écrans du lot 2

### Nouveaux composants
- **Bouton Alertes (en-tête de l'accueil)** : rond 44 × 44, fond `surface`,
  icône cloche en trait. Pastille de 9 px en haut à droite, couleur du
  niveau de la dernière alerte non lue (`mid` ou `low`), absente s'il n'y
  en a pas. aria-label : « Alertes : n nouvelles ».
- **Carte alerte du jour** (accueil) : fond `surface`, rayon 14, point de
  8 px de la couleur du niveau, puis « Alerte · <thème> » (12/600, couleur
  du niveau), titre (14/600), constat en une ligne (13, `textMuted`),
  chevron à droite. Toute la carte ouvre l'historique.
- **Carte alerte (historique)** : fond `surface`, rayon 16. Ligne 1 :
  « <niveau> · <thème> » (12/600, couleur du niveau) et la date à droite.
  Puis titre (15/600), « Constat · … » et « Cause probable · … »
  (13, libellés en `textMuted`, texte en `textSoft`), et l'action en
  13/600 `text`.
- **Niveaux d'alerte** : « À surveiller » = `mid`, « Important » = `low`.
  Toujours écrits en toutes lettres.
- **Filtres** (pastilles) : hauteur 36, rayon pilule. Actif : fond `text`,
  texte `bg`. Inactif : contour `border`, texte `textSoft`.
- **Barre de progression nutrition** : comme la jauge, couleur selon la
  cible : `good` si atteinte (au moins 90 % de la cible), `mid` si en
  dessous, avec une ligne d'état sous la barre (« Dans la cible »,
  « Sous la cible · n jours sur 7 cette semaine »).
- **Ligne de réglage** : hauteur minimale 52, libellé à gauche (14),
  valeur à droite : champ numérique 96 × 40 (contour `border`, fond `bg`,
  aligné à droite) suivi de l'unité (13, `textMuted`), ou valeur en
  Space Grotesk 15/600. Séparateur 1 px `surfaceAlt` entre les lignes,
  lignes regroupées dans une carte `surface` de rayon 16, titre de groupe
  en libellé de section au-dessus.
- **Interrupteur** : 52 × 32, rayon 16, bouton rond de 24 px `text` ;
  activé = piste `good`, bouton à droite ; désactivé = piste `border`.
  role="switch" et aria-checked.

### Accueil (lot 2)
L'écran défile. Ordre : en-tête (aube + date, bouton Alertes) → anneau et
pastille → Recommandation du jour → carte alerte du jour (seulement s'il
y en a une, et jamais pendant la calibration) → 3 tuiles de la nuit →
jauge de charge 7 j / 28 j (texte d'état coloré : `good` équilibrée,
`mid` en hausse ou sous-charge, `low` au-dessus de 1,5) → carte
« Nutrition d'hier » (protéines puis calories avec leurs barres, puis
glucides, lipides et nombre de repas en petit ; mention « via Suivi
macro » en haut à droite) → bouton « Saisir poids et ressenti » →
navigation.
Le bouton Alertes remplace le bouton rond du diagnostic du lot 1 : le
diagnostic s'ouvre depuis l'écran Sources. La carte alerte du jour écrit
aussi le niveau en toutes lettres après le thème (« Alerte · Charge ·
Important »), pour que la couleur ne porte jamais seule le sens.

### Historique des alertes
Retour + titre « Alertes », filtres Toutes / Récupération / Charge /
Nutrition, liste des cartes alerte de la plus récente à la plus ancienne.
En bas, centré (12, `textMuted`) : « Au plus 2 alertes par jour · silence
de <plage> » et « Ces alertes ne remplacent pas un avis médical. »
Pendant la calibration, un message unique à la place de la liste :
« Les alertes s'activeront après 28 jours de données (n / 28). »

### Réglages
Accessible par l'onglet Réglages. Groupes, dans l'ordre :
1. **Mes cibles** : poids visé (kg, vide = « à définir »), protéines
   (g/kg, défaut 1,8), calories par jour (kcal), séances par semaine.
   Sous le groupe : « Soit <n> g de protéines par jour avec ton poids
   actuel (moyenne 7 j). »
2. **Profil cardiaque** : année de naissance (sert à estimer la FC max),
   sexe (pastilles Homme / Femme, « à définir » par défaut ; choisit le
   coefficient du calcul de charge), FC max (bpm), estimée par défaut
   (l'estimation s'affiche en indication dans le champ vide). Sous le
   groupe : « Sert au calcul de la charge. Laisse la valeur estimée si tu
   ne connais pas la tienne. »
3. **Notifications** : heure du récap (défaut 7:30), plage silencieuse
   (défaut 22:00 – 7:00), interrupteur « Alertes ». Les heures se règlent
   avec des boutons − et + de 44 px de part et d'autre de la valeur
   (pas de 15 min pour le récap, 30 min pour la plage silencieuse).
   Les autorisations (notifications, lecture en arrière-plan) restent
   sur l'écran Sources.
4. **Données** : « Sources de données » (ouvre l'écran Sources),
   « Exporter mes données (CSV) », « Effacer toutes les données » en
   `low` avec une confirmation obligatoire.

## États à toujours prévoir
- **Calibration en cours** (< 28 jours) : pas de score coloré ; afficher « Calibration : n / 28 jours » et les valeurs brutes, sans jugement.
- **Donnée manquante** (nuit non synchronisée, Health Connect absent, permission refusée) : message clair et action proposée, jamais une valeur inventée.
- **Valeurs fictives** : uniquement dans les tests et les maquettes, jamais dans l'app livrée.

## Textes
- Français, tutoiement, phrases courtes et actionnables (« Séance lourde OK », « Journée légère : mobilité ou marche »).
- Jamais de vocabulaire de diagnostic médical.
