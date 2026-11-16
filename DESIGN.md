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
- **La couleur porte un sens, jamais seule** : chaque couleur d'état est accompagnée d'un libellé texte (« En forme », « reçue », « absente »…).
- **Pas d'emoji, pas de dégradés décoratifs, pas d'ombres.** Icônes en trait fin (2 px), couleur du texte.
- Thème sombre uniquement.

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
| Constat d'une carte (style « constat », lot 5a.1) | Inter | 16 / 500, interligne 22 |
| Passage en relief dans une phrase (lot 5a.1) | chiffre : Space Grotesk ; action : Inter | 600, couleur `text`, taille de la phrase |
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
- **Barre de navigation** : 72 px, 4 onglets (Aujourd'hui, Tendances, Sport, Réglages ; 5 à partir du lot 4, voir « Écrans du lot 4 »), icône + libellé 11 px, actif en `text`, inactifs en `#8B97A6`.

## Écrans du lot 1
0. **Démarrage** : voir « Identité ».
1. **Accueil – récap du matin** : en-tête aube + date, titre, accès au diagnostic (bouton rond), anneau + pastille, carte Recommandation, 3 tuiles (HRV, FC au repos, Sommeil), jauge de charge 7 j / 28 j, bouton « Saisir poids et ressenti », navigation.
2. **Détail d'un indicateur** (HRV d'abord, même gabarit pour FC au repos et sommeil) : retour, valeur + pastille d'état + moyenne 7 j, onglets de période, graphique avec plage normale et légende, carte « Ce qui fait ton score de récupération » (contributions +, =, −).
3. **Saisie du matin** : poids (champ numérique, kg), ressentis Énergie / Courbatures / Humeur (1 à 5), note libre facultative, bouton Enregistrer.
4. **Sources de données** : calibration des normes (jauge « n / 28 jours »), carte Helio Strap (dernière synchro, types reçus), carte Suunto (« hors périmètre », sans bouton), poids et Suivi macro (via Health Connect), bouton « Synchroniser maintenant ».

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
   (g/kg, défaut 1,8), calories par jour (kcal), séances par semaine,
   zone 2 par semaine (min, défaut 120 ; ajoutée au lot 3).
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

## Écrans du lot 3

### Nouveaux composants
- **Barre des zones cardiaques** : barre empilée de 12 px, rayon 6, 2 px
  entre les segments, largeur de chaque segment = part du temps.
  Couleurs : Z1 `#5C6B7E`, Z2 `info`, Z3 `mid`, Z4-5 `low`. Légende en
  dessous sur 4 colonnes (11 px, `textMuted`, Z2 en `#7DB8FF`), puis une
  ligne d'état : « Zone 2 : <n> min sur <cible> min visées » en `good` si
  la cible est atteinte, sinon `mid`.
- **Ligne d'exercice (force)** : hauteur minimale 52, séparateur
  `surfaceAlt` au-dessus. À gauche : nom (14/600) et tendance (12 ;
  `good` si en hausse, `mid` si stable depuis 6 semaines, `textMuted`
  sinon). Au centre : mini-barres des 12 dernières semaines (largeur 5,
  hauteur 8 à 32 px, `#5C6B7E`, la dernière dans la couleur de la
  tendance). À droite : 1RM estimé en Space Grotesk 20/600 + « kg ».
- **Sélecteur − / +** : champ de 48 px de haut, contour `border`, fond
  `bg`, rayon 12 ; boutons − et + de 44 × 44 de part et d'autre de la
  valeur (Space Grotesk 17/600 + unité 12 `textMuted`). Pas de 2,5 kg
  pour la charge, de 1 pour les répétitions (1 à 12). Chaque bouton a un
  aria-label (« Plus 2,5 kg »…).
- **Carte suggestion** : fond `info` à 10 %, bordure 1 px `info`, rayon 16.
  Libellé « À essayer cette semaine » (12/600, `#7DB8FF`, majuscules),
  proposition en 16/600, puis le manque comblé et où le faire à Paris
  (13, `textSoft`), puis éventuellement un second manque en 12 `textMuted`.
- **Carte lien observé** : fond `surface`, rayon 16. Ligne 1 :
  « Lien fort | modéré | faible » (12/600) et « <n> jours comparés »
  (12, `textMuted`). Couleur du libellé et de la barre mise en avant :
  `good` si le lien est favorable, `mid` s'il est défavorable, `info` si
  le lien est faible. Puis la phrase (15/600), deux barres de comparaison
  (situation de référence en `#5C6B7E`, situation étudiée dans la
  couleur du lien, valeurs à droite), puis l'action conseillée (13,
  `textSoft`).

### Sport (onglet Sport)
L'écran défile. Ordre : « Semaine du … au … » + titre « Ta progression » →
carte « Cette semaine » (séances faites / cible, temps d'activité, charge
7 j / 28 j, puis barre des zones cardiaques) → carte « Force · 1RM estimé »
(3 lignes d'exercice : squat, développé couché, soulevé de terre ;
« sur 12 semaines ») → carte « Composition corporelle » (poids moyen 7 j
en Space Grotesk 28/600, tendance en kg/semaine, courbe du poids lissé
avec la cible en pointillé, puis une phrase d'interprétation) → carte
suggestion → bouton « Saisir ma séance de musculation » → navigation.

### Saisie de séance de musculation
Retour + titre « Ta séance » + « Meilleure série de chaque exercice ».
Carte de la séance détectée (type, durée, date, « détectée par le Helio
Strap », FC moyenne). Puis une carte par exercice clé : nom, bouton
« Pas fait » (la carte passe à 60 % d'opacité et masque la saisie),
sélecteurs charge et répétitions côte à côte, puis « 1RM estimé <n> kg »
avec l'écart à ton niveau (`good` + « record » si au-dessus). Bouton
« Enregistrer la séance » en bas.

### Tendances (onglet Tendances)
« Calculé sur tes 90 derniers jours » + titre « Ce que tes données
disent ». Pastilles vers les détails (HRV, FC au repos, Sommeil, Poids).
Libellé « Liens observés » puis les cartes lien observé, du plus fort au
plus faible (3 au plus). En bas, centré (12, `textMuted`) : « Un lien
observé n'est pas une preuve de cause. » et « Seuls les liens assez
réguliers sur au moins 20 jours sont affichés. » S'il n'y en a aucun :
« Pas encore assez de données pour repérer des liens fiables. »

## Écrans du lot 4

### Navigation
La barre de navigation passe à 5 onglets : Aujourd'hui, Tendances, Sport,
Coach, Réglages. Icône Coach : bulle de dialogue en trait avec deux lignes.

### Nouveaux composants
- **Badge « 100 % sur ton téléphone »** : pilule de 32 px, fond `surface`,
  icône cadenas 14 px + texte 12 `textSoft`. Il ouvre l'écran Modèle.
- **Carte bilan de la semaine** : fond `surface`, rayon 16. Libellé
  « Bilan de la semaine » (12/600, `#7DB8FF`, majuscules) et dates à
  droite ; phrase de synthèse (15/600) ; « Ce qui a marché · … » (libellé
  `good`) et « Ce qui coince · … » (libellé `mid`), texte 13 `textSoft` ;
  séparateur, « Tes 2 actions pour la semaine » (12 `textMuted`) puis
  2 actions numérotées en 14/600 ; en bas, le lien « Voir les chiffres
  utilisés » (comme dans les bulles de réponse, ci-dessous) : les chiffres
  (11, `#8B97A6`) sont repliés par défaut (depuis le lot 4.1).
- **Bulles de conversation** : question à droite, fond `track`, rayon
  16 16 4 16 ; réponse à gauche, fond `surface`, rayon 16 16 16 4, texte
  14, l'action conseillée en 14/600, puis un lien « Voir les chiffres
  utilisés » (12/600, `#7DB8FF`) : les chiffres (11, `#8B97A6`) sont
  repliés par défaut et s'affichent à l'appui (« Masquer les chiffres
  utilisés » pour les replier). Largeur maximale 80 % (question) et 88 %
  (réponse).
- **Questions suggérées** : mêmes pastilles que les filtres (contour
  `border`, texte `textSoft`).
- **Champ de question** : champ de 48 px (contour `border`, fond
  `surface`, rayon 14) + bouton carré 48 × 48 fond `text`, flèche `bg`,
  aria-label « Envoyer ». Pendant la génération, le bouton devient
  « Arrêter ». Mention dessous (11, `#8B97A6`, centrée) : « Le coach
  explique tes chiffres, il n'en invente pas. Ce n'est pas un avis
  médical. »
- **Lien « Pourquoi ? »** : sur les cartes alerte et lien observé, texte
  13/600 `#7DB8FF` en bas de carte. Il ouvre un panneau du bas avec
  l'explication du coach (même style que la bulle de réponse). Masqué si
  le modèle n'est pas installé ou si le coach est désactivé.

### Réglages (groupe Coach)
Interrupteur « Coach » en tête du groupe (activé par défaut), puis
« Modèle du coach » et « Effacer la conversation ». Désactivé : ni bilan,
ni question, ni « Pourquoi ? » ; le modèle reste installé et la
conversation est gardée.

### Coach (onglet Coach)
En-tête « Ton coach Aube » + titre « Coach » + badge à droite. Carte bilan
de la semaine (la plus récente) → questions suggérées → conversation →
champ de question en bas → navigation. Si le modèle n'est pas installé :
une carte unique qui explique le coach et renvoie vers l'écran Modèle.
Si le coach est désactivé : une carte unique « Le coach est désactivé »
avec un bouton secondaire « Ouvrir les Réglages ».

### Modèle du coach
Retour + titre « Modèle du coach ». Carte « Tout reste sur ton téléphone »
(cadenas `good`). Sans modèle : « Installer en 3 étapes » (télécharger le
fichier depuis l'ordinateur, le copier dans Téléchargements, le choisir
dans Aube), taille et espace nécessaires, bouton « Choisir le fichier du
modèle ». Avec modèle : lignes de réglage État (« Installé · prêt » en
`good`), Fichier (nom + taille), Vitesse mesurée (mots / s), Bilan de la
semaine (« dimanche, à l'ouverture du coach »), puis bouton secondaire « Supprimer
le modèle » en `low` avec confirmation.

## Écrans du lot 4.1

### Accueil : carte « Ouvrir Zepp »
Sous l'en-tête (et le bandeau d'accès s'il y en a un), seulement quand la
nuit du jour n'est pas encore arrivée dans Health Connect, que l'accès à
Health Connect est accordé et que l'app Zepp est installée. Carte `surface`
(rayon 16) : « Ta nuit n'est pas encore arrivée » (texte important), une
phrase d'explication (13, `textSoft`), puis un bouton secondaire « Ouvrir
Zepp ». Il ouvre Zepp ; au retour dans Aube, la synchro se relance.

## Écrans du lot 5a

### Nouveaux composants
- **Bouton Période (en-tête de l'accueil)** : rond 44 × 44, fond `surface`,
  icône drapeau en trait, à côté du bouton Alertes.
  aria-label « Signaler une période ».
- **Panneau « Signaler une période »** : panneau du bas, fond `surface`,
  rayon 20 en haut, poignée 40 × 4 `border`, voile `rgba(0,0,0,0.55)`.
  Titre (Space Grotesk 18/600), phrase « Ces jours seront exclus de tes
  normes, et les alertes seront mises en pause. » (13, `textMuted`),
  grille de 2 colonnes de boutons de 48 px (contour `border`) : Malade,
  Blessure, Voyage, Vacances, Autre. Puis la date de début (aujourd'hui
  par défaut, modifiable jusqu'à 14 jours en arrière), un bouton
  principal « Commencer la période » et un bouton « Annuler ».
- **Bandeau de période** (accueil) : fond `info` à 10 %, bordure `info`,
  rayon 16. « Période · <type> » (12/600, `#7DB8FF`, majuscules) et
  « depuis n jours » à droite ; « Tes normes et tes alertes sont en
  pause. » (14/600) ; une phrase propre au type (13, `textSoft`) ;
  bouton pilule « Terminer la période » (contour `info`). Pendant une
  période, l'anneau de récupération passe en `#4A5A6E` et sa pastille
  affiche « En pause » : pas de jugement de couleur.
- **Pastilles de comportement** (journal) : hauteur 40, rayon pilule.
  Cochée : fond `text`, texte `bg`. Non cochée : contour `border`, texte
  `textSoft`.

### Accueil (lot 5a)
En-tête : boutons Période et Alertes. Sous l'anneau, le bandeau de période
s'il y en a une ouverte (la carte alerte du jour est alors masquée). Le
bouton « Saisir poids et ressenti » devient « Journal du matin » ; une
fois le journal du jour enregistré, il devient un bouton secondaire
« Journal rempli ✓ » (qui permet de le modifier).

### Journal du matin (remplace l'écran Saisie du matin)
Retour + titre « Journal du matin » + « 15 secondes pour comprendre ta
nuit ». « Hier, tu as… » + lien « Gérer la liste », pastilles de
comportement, puis « Rien coché = rien de particulier. » Puis les champs
existants : poids, ressenti (énergie, courbatures, humeur), note libre
« Autre chose à noter ? ». Bouton « Enregistrer ». Sélecteur de jour en
haut (« Aujourd'hui » et les 7 jours précédents) pour corriger un jour
passé.

### Gérer la liste des comportements
Liste en lignes de réglage : nom, interrupteur « Affiché », possibilité de
renommer. Bouton « Ajouter un comportement » (40 caractères au plus).
Pas de suppression : un comportement masqué garde son historique.

### Mes périodes (Réglages > Données)
Liste des périodes, de la plus récente à la plus ancienne : type, dates,
nombre de jours. Toucher une période permet de modifier ses dates ou de
la supprimer (avec confirmation).

## Écrans du lot 5a.1 (écriture et relief)
Ces points remplacent les descriptions plus anciennes ci-dessus. Les règles d'écriture sont dans
« Textes », en fin de fichier ; les textes eux-mêmes dans `src/domain/texts/`.

### Accueil
- Pastille sous l'anneau, sans répéter « Récupération » (déjà au centre de l'anneau) :
  « En forme », « Forme moyenne », « Corps fatigué » ; « Norme en construction » pendant la
  calibration ; « Nuit manquante » ou « Récap incomplet » sans score ; aucune pastille pendant
  une période (le bandeau dit déjà « en pause »).
- Carte « Recommandation du jour » : le pourquoi en petit (`textSoft`), puis l'action en dernière
  ligne, style « constat » avec relief. Nuit absente : pas de raison (la carte « Ouvrir Zepp »
  l'explique déjà).
- Carte « Charge de la semaine » (au lieu de « Charge 7 j / 28 j ») : pastille d'état à droite du
  titre (« Équilibrée » `good`, « En hausse » et « En baisse » `mid`, « Trop haute » `low`),
  phrase en style « constat » (« Tu t'entraînes *45 % de plus* que d'habitude cette semaine »),
  jauge bornée « −100 % » / « +100 % », détail en petit (séances, charge par jour).
- Erreur de lecture : message simple (« Tire l'écran vers le bas pour réessayer »), jamais le
  détail technique.

### Alertes
Carte de l'historique : titre (15/600), constat (15/400, chiffre en relief), pourquoi en petit
(`textSoft`), action en dernière ligne (14/500, relief en gras). Plus de libellés « Constat · » ni
« Cause probable · ». Les alertes enregistrées avant le lot 5a.1 gardent leur texte d'origine.

### Journal du matin et « Gérer la liste »
- Chaque ressenti a son échelle en phrase sous les boutons 1 à 5 (« De 1 (aucune) à 5 (très
  fortes) : plus la note est haute, plus tu as mal »).
- « Gérer la liste » : en modifiant ou en ajoutant un comportement, champ facultatif « En phrase »
  (80 caractères au plus) ; vide, l'exemple affiché est la phrase utilisée.

### Coach
- Carte « Bilan de la semaine » : « Ce qui a marché : … » et « Ce qui coince : … » en phrases
  (propositions reliées par « et »). Le bilan écrit par l'app quand le modèle n'a pas pu formuler de
  conseil sûr se lit comme les autres (« … En revanche, … ») : plus de mention « Rédigé par l'app ».
- Modèle du coach : « Le coach est *prêt*. » (style « constat ») au-dessus du groupe « Modèle
  installé », à la place de la ligne « État · Installé · prêt ».

### Sport et écrans de détail
- Carte « Cette semaine » : la case « Charge » affiche l'état en mots (« En hausse », couleur
  d'état) et la ligne dessous la phrase de l'accueil (« Tu t'entraînes 45 % de plus… »).
- Graphique de tendance : la bande s'appelle « Ta norme » ; les barres défavorables « Sous ta
  norme » (HRV), « Au-dessus de ta moyenne » (FC au repos), « Nuit courte » (sommeil).
- Composition corporelle sans poids visé : « Indique ton poids visé dans Réglages. »

### Réglages, Sources, Mes périodes
- Notifications : « Heures de silence : début » et « Heures de silence : fin ».
- Champ vide : « à indiquer » (au lieu de « à définir ») ; Sexe non choisi : « Choisis ».
- L'écran technique « Diagnostic » s'appelle « Contrôle des données » (titre et bouton de Sources).
- Erreur d'enregistrement : « Pas enregistré. *Réessaie dans un instant.* », jamais le détail technique.

### Liens observés
En-tête en mots : « Effet marqué | net | léger », suivi de « qui t'aide » ou « qui te dessert »
(sauf effet léger). La phrase passe en style « constat » avec l'écart en relief et son repère
(« que les autres nuits »).

## États à toujours prévoir
- **Calibration en cours** (< 28 jours) : pas de score coloré ; afficher « Calibration : n / 28 jours » et les valeurs brutes, sans jugement.
- **Donnée manquante** (nuit non synchronisée, Health Connect absent, permission refusée) : message clair et action proposée, jamais une valeur inventée.
- **Valeurs fictives** : uniquement dans les tests et les maquettes, jamais dans l'app livrée.

## Textes

Aube parle comme un coach qui te connaît : une phrase complète, un fait, une
action. Français, tutoiement.

### Règles
1. Une phrase avec un verbe, pas une étiquette. Les étiquettes courtes
   restent permises pour les titres de carte et les pastilles.
2. Constat, puis pourquoi, puis action, dans cet ordre ; l'action toujours
   en dernière ligne.
3. Un seul élément en relief par phrase : le chiffre qui compte ou
   l'action (composant d'emphase, voir « Relief »).
4. Le nom en clair d'abord, le sigle ensuite, à sa première apparition sur
   un écran : « variabilité cardiaque (HRV) ».
5. Ratios et écarts traduits en mots : « 45 % de plus que d'habitude »
   plutôt que « ratio 1,45 ».
6. Parler du signal, jamais d'une cause médicale : « ton corps montre des
   signes de fatigue », pas « infection qui commence ». Jamais de
   vocabulaire de diagnostic.
7. Pas de machinerie visible : vrais pluriels (jamais « (s) »), aucun
   message d'erreur technique (réservé à l'écran de diagnostic), pas de
   « à définir » mais une invitation (« Indique ton poids visé »).
8. Typographie française : apostrophe ’, guillemets « », espace insécable
   avant : ; ! ?

### Glossaire (un mot par notion)
| Notion | Mot retenu | À abandonner |
| --- | --- | --- |
| Plage de valeurs habituelle calculée sur tes nuits | ta norme (« dans ta norme », « sous ta norme ») | plage, plage normale, plage habituelle |
| Moyenne simple sur une période | ta moyenne sur N jours (toujours avec la durée) | « ta moyenne » seule |
| HRV | variabilité cardiaque (HRV), puis HRV | — |
| FC au repos | fréquence cardiaque au repos, puis FC au repos | FC seule |
| Charge aiguë / chronique | ta charge de la semaine comparée à ton rythme habituel | 7 j / 28 j, ratio |
| 1RM | force estimée (1RM), puis 1RM | — |
| Plage silencieuse | heures de silence | silence à partir de / jusqu'à |
| Poids | kg partout | kilos |

### Relief
- Trois étages par carte : le constat en style « constat » (15–16 px),
  le chiffre clé ou l'action en relief, le détail en petit gris.
- Relief = gras (Inter 600) pour une action, police des chiffres
  (Space Grotesk 600) pour un chiffre, dans la couleur du texte principal.
  Jamais plus d'un élément en relief par phrase.
- Un même message n'apparaît qu'une fois par écran (pas d'état répété
  entre la pastille, la carte et le libellé).

### Exemples avant / après (le relief est entre astérisques)
| Avant | Après |
| --- | --- |
| Séance lourde OK | *Feu vert* pour une séance lourde aujourd'hui. |
| Récap incomplet · Synchronise ta nuit pour obtenir ton récap | Ta nuit n'est pas encore arrivée. *Ouvre Zepp* pour l'envoyer. |
| Pic de charge (au-dessus de 1,5) | Tu t'entraînes *45 % de plus* que d'habitude cette semaine. |
| Ta FC au repos est à +6 bpm de ta moyenne depuis 2 jours. Fatigue accumulée ou infection qui débute. | Ta fréquence cardiaque au repos est *6 battements au-dessus* de ta moyenne sur 30 jours depuis 2 jours : ton corps récupère moins bien. *Évite l'intensité aujourd'hui.* |
| Les jours avec alcool, tu dors 12 % de moins la nuit suivante. | Les soirs où tu bois de l'alcool, tu dors *12 % de moins*. |
| Bons points de la semaine : récupération 64 sur 100 en moyenne, zone 2 : 45 min pour 90 visées. | Ta récupération a tenu à *64 en moyenne*. En revanche, l'endurance douce manque : *45 min sur les 90 visées*. |
| Installé · prêt | Le coach est *prêt*. |
| L'enregistrement a échoué : <erreur technique> | Pas enregistré. *Réessaie dans un instant.* |
