# Référentiel des preuves – Aube

Version du 24 novembre 2026. À relire une fois par an, ou quand un lien de mes données s'écarte fortement d'une fiche.

## 1. À quoi sert ce document

Aube n'a qu'une personne et peu de jours de données. Ce référentiel apporte ce que la recherche sait déjà, pour quatre usages :

1. **Valeurs de départ des liens** (mise à jour bayésienne, lot 5b) : chaque lien démarre de l'effet moyen publié, puis mes données le corrigent jour après jour. Après quelques semaines, ce sont mes données qui dominent.
2. **Liste fermée des liens testés** : on ne teste que les liens de ce document, avec le sens, le délai et la taille d'effet attendus.
3. **Garde-fou de plausibilité** : un résultat de sens contraire à une preuve forte demande deux fois plus de données avant d'être affiché, avec la mention « inattendu ».
4. **Fiches du coach** : le modèle local s'appuie sur la rubrique « Ce que dit la recherche » pour expliquer un « Pourquoi ? », sans inventer de mécanisme.

### Règles communes

- **Tout est intra-individuel** : on compare mes jours entre eux, jamais à une norme de population. Les chiffres publiés servent de point de départ, jamais de verdict.
- **VFC** : toujours le logarithme de la rMSSD, en moyenne glissante sur 7 nuits, comparée à ma propre norme (déjà le cas depuis le lot 1).
- **Niveaux de preuve** :
  - **Fort** : méta-analyse d'essais contrôlés, ou plusieurs grandes études intra-individuelles concordantes.
  - **Moyen** : quelques essais, ou une grande étude observationnelle intra-individuelle.
  - **Faible** : études transversales, petits échantillons, mécanismes seulement, ou données publiées par un fabricant.
- **Valeur de départ** = une moyenne et un écart-type. L'écart-type est volontairement large : un lien à preuve faible a une valeur de départ proche de zéro et très incertaine, pour que mes données décident vite.
- **Poids de la valeur de départ** : elle compte comme environ 10 jours de données (réglable). Au-delà de 30 à 40 jours observés, elle ne pèse presque plus.
- **Sources** : résumés et articles en accès libre. Chaque fiche dit sur quoi elle s'appuie. Aucun passage recopié : chiffres et références seulement.

---

## 2. Fiches de mesure

### M1 – Fiabilité des mesures du bracelet

**Ce que dit la recherche**
- Les capteurs optiques au poignet mesurent bien la fréquence cardiaque de nuit. Une montre Polar testée de nuit contre une ceinture ECG a une concordance très forte pour la fréquence cardiaque (0,998) et le logarithme de la rMSSD (0,931).
- La rMSSD est mesurée avec précision de nuit, et la moyenne de la nuit a encore moins d'erreur qu'une mesure de 5 minutes (étude Oura contre ECG).
- Le biais d'un capteur au poignet sur la VFC peut approcher la taille d'un changement qui compte (étude Whoop contre ECG). D'où la règle : comparer une valeur à ma propre norme, jamais à un chiffre absolu ou à un autre appareil.
- Sommeil : les bracelets distinguent bien sommeil et éveil, et font aussi bien ou mieux que l'actimétrie de recherche. Les phases (profond, paradoxal) sont estimées avec une précision moyenne, variable selon les appareils.
- Aucune étude indépendante sur le Helio Strap trouvée : ces conclusions viennent d'appareils de la même catégorie.

**Niveau de preuve** : moyen.

**Conséquences pour Aube**
- Fiables : fréquence cardiaque de nuit, FC au repos, VFC moyenne de la nuit, heures de coucher et de lever, durée du sommeil.
- À utiliser avec prudence : minutes de sommeil profond et paradoxal. Pas de lien observé affiché sur une phase de sommeil seule ; elles peuvent apparaître en détail.
- Ne jamais mélanger des VFC de deux appareils (règle déjà en place).

**Références**
- Nuuttila et al. 2022, Sensors – Polar Vantage V2 au repos et de nuit : https://pmc.ncbi.nlm.nih.gov/articles/PMC8747571
- Cao et al. 2022, JMIR – Oura contre ECG de nuit : https://www.jmir.org/2022/1/e27487/
- Bellenger et al. 2021, Sensors – Whoop contre ECG : https://pmc.ncbi.nlm.nih.gov/articles/PMC8160717/
- Chinoy et al. 2021, Sleep – sept appareils contre polysomnographie : https://pmc.ncbi.nlm.nih.gov/articles/PMC8120339
- Miller et al. 2022, Sensors – six appareils, sommeil, FC et VFC : https://pubmed.ncbi.nlm.nih.gov/36016077/

### M2 – Plus petit changement de VFC qui compte

**Ce que dit la recherche**
- La moyenne sur une semaine du logarithme de la rMSSD reflète mieux l'adaptation à l'entraînement qu'une valeur isolée (Plews et al.).
- Il faut au moins 3 nuits mesurées dans la semaine pour que cette moyenne soit utilisable : l'effet détecté passe de 0,20 avec une seule nuit à environ 0,5 avec 3 nuits ou plus (Plews et al. 2014).
- Ordre de grandeur du plus petit changement qui compte : environ 3 % pour le logarithme de la rMSSD (Buchheit 2014) ; entre 1,5 et 6,5 % selon les personnes dans l'étude Whoop.
- Une baisse progressive de la moyenne sur 7 jours, avec une variabilité d'un jour à l'autre qui diminue, a précédé un surentraînement dans une étude de cas (Plews et al. 2012).

**Niveau de preuve** : moyen (consensus de pratique, petits échantillons).

**Valeur de départ pour Aube**
- Plus petit changement qui compte = 0,5 × écart-type de ma moyenne glissante sur 7 nuits, calculé sur ma norme de 60 jours ; à défaut, 3 %.
- Moyenne de la semaine calculée seulement s'il y a au moins 3 nuits mesurées sur 7.

**Conséquences pour Aube** : un écart plus petit que ce seuil n'est jamais présenté comme un changement. Ce seuil sert aussi de « taille d'effet qui compte » pour tous les liens sur la VFC.

**Références**
- Plews, thèse AUT – VFC sur 7 jours contre valeur isolée : https://openrepository.aut.ac.nz/items/d7b41d29-e92e-4acf-90ea-ed68d84d6c73
- Plews et al. 2014, IJSPP – nombre de jours nécessaires : https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_1559624308
- Plews et al. 2012 – cas de surentraînement : https://pubmed.ncbi.nlm.nih.gov/22367011/
- Buchheit 2014, Frontiers in Physiology – erreur de mesure et plus petit changement : https://pmc.ncbi.nlm.nih.gov/articles/PMC3936188
- Institut australien du sport – bonnes pratiques VFC : https://www.ais.gov.au/__data/assets/pdf_file/0013/1130260/HRV-BPG_FINAL.pdf

### M3 – Fiabilité de la masse grasse (balance à impédance)

**Ce que dit la recherche**
- Le poids des balances grand public est fiable (à environ 0,3 kg près).
- La masse grasse est estimée, pas mesurée : écart de ±3 à 8 points avec le DEXA, plus grand chez les personnes très musclées ou très minces, et très sensible à l'hydratation (plusieurs points dans la même journée).
- Ces balances sont en revanche répétables dans les mêmes conditions, ce qui rend le suivi de tendance possible.
- Graisse viscérale, masse osseuse, âge métabolique : estimations par formules générales, non fiables.

**Niveau de preuve** : moyen.

**Conséquences pour Aube (lot de composition corporelle)**
- Lire seulement le poids et la masse grasse.
- Afficher une tendance lissée sur 7 à 14 jours, marquée « estimation » ; ignorer les variations de moins d'environ 1 point.
- Pesée au réveil, à jeun, avant de boire et de s'entraîner.
- Aucun lien observé sur la masse grasse d'un jour donné.

**Références** (voir l'échange du 18 novembre 2026)
- Synthèse des études de validation : https://docs-nine-silk.vercel.app/blog/are-smart-scales-accurate-body-fat
- Hume Health – balances et DEXA : https://humehealth.com/en-ca/blogs/hume-blogs/smart-scale-accuracy
- Étude de validité de la Xiaomi Mi Scale 2 : https://sanad.iau.ir/en/Journal/DownloadFile/796826

---

## 3. Fiches de liens

### L1 – Charge d'entraînement → VFC et FC au repos des jours suivants (modèle forme / fatigue)

**Ce que dit la recherche**
- Le modèle de Banister (1975) décrit chaque séance comme créant une « forme » qui s'efface lentement et une « fatigue » plus grande qui s'efface vite. La performance (ou ici la récupération) = forme − fatigue.
- Calé sur des mesures individuelles, ce modèle explique souvent une grande part des variations ; il demande 60 à 90 jours de données pour régler ses paramètres.
- Limites connues : le modèle suppose une réponse linéaire et des effets qui s'additionnent ; il réagit mal aux blocs de charge très inhabituels.

**Délai** : effet de fatigue visible dès la nuit suivante, sur quelques jours.

**Niveau de preuve** : moyen (modèle classique, peu validé sur la VFC elle-même).

**Valeur de départ pour Aube**
- Durées de départ : fatigue 7 jours, forme 42 jours (valeurs usuelles du modèle, celles de nombreux outils d'entraînement).
- Recherche sur grille : fatigue de 1 à 10 jours, forme de 20 à 60 jours ; on garde le couple qui prévoit le mieux ma VFC, vérifié sur une période non utilisée pour le régler.
- Activation : au moins 60 jours avec VFC et charge fiables (règle « charge non fiable » respectée).

**Ce que j'obtiens** : « la fatigue d'une grosse séance met environ N jours à s'effacer chez toi », pour espacer les séances dures.

**Références**
- Synthèse du modèle et de ses variantes (arXiv 2025) : https://arxiv.org/pdf/2505.20859
- Modèle forme / fatigue : formulation et limites (SportRxiv) : https://rgu-repository.worktribe.com/OutputFile/1871154
- Durée de données recommandée et part de variance expliquée (JSSM) : https://jssm.org/jssm-17-402.xml
- VFC et ratio de charge (étude de 2017) : https://pmc.ncbi.nlm.nih.gov/articles/PMC5721172/

### L2 – Note d'effort de la séance (charge perçue) et charge cardiaque

**Ce que dit la recherche**
- Méthode de Foster : note d'effort de 0 à 10 × durée en minutes, demandée environ 30 minutes après la séance.
- Elle suit bien la charge cardiaque pour l'endurance continue (corrélation d'environ 0,7), moins pour les séances très intenses (0,3 dans une étude sur le ski de fond).
- Pour les séances de type entraînement fonctionnel ou musculation, la note d'effort reflète mieux l'effort réel que les méthodes cardiaques, qui sous-estiment ces séances.

**Niveau de preuve** : moyen à fort pour l'endurance, moyen pour la musculation.

**Valeur de départ pour Aube**
- Notification « Note ta séance » environ 30 minutes après la fin de la séance (plutôt qu'à son arrivée dans Health Connect, si possible).
- Charge d'une séance = combinaison de la charge cardiaque et de la note d'effort ; pour la musculation et l'escalade, la note d'effort prime. Si la fréquence cardiaque manque, la note d'effort seule.
- La règle exacte de combinaison est réglée au lot 5d, avec la collecte de la note, et vérifiée sur mes données (corrélation entre les deux pour mes séances d'endurance).

**Références**
- Arney, Foster et al. 2019, IJSPP – méthode de la note d'effort et échelles : https://iris.unicas.it/bitstream/11580/70706/5/47_Arney%20sRPE%20Comparision%20of%20Scales%20IJSPP%202019.pdf
- Note d'effort et charge cardiaque selon l'intensité (ski de fond) : https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11155691/
- Note d'effort plus juste que la charge cardiaque en entraînement fonctionnel (Frontiers 2020) : https://pmc.ncbi.nlm.nih.gov/articles/PMC7435063/

### L3 – Séance intense tardive → nuit

**Ce que dit la recherche**
- Méta-analyse de 23 études (Stutz et al. 2019) : une séance le soir n'abîme pas le sommeil ; elle augmente même un peu le sommeil profond (+1,3 point).
- Exception : une séance intense finie moins d'une heure avant le coucher peut retarder l'endormissement et raccourcir le sommeil.

**Délai** : nuit suivante.

**Niveau de preuve** : fort pour « le soir n'est pas un problème », moyen pour l'exception.

**Valeur de départ pour Aube**
- Redéfinir le lien actuel « séance après 20 h » en « séance intense finie moins d'une heure avant le coucher ». L'ancien lien peut rester en détail.
- Durée du sommeil : −15 min (écart-type 20 min). VFC : −2 ms (écart-type 5 ms), preuve faible.
- Séance modérée le soir : effet de départ nul.

**Référence**
- Stutz et al. 2019, Sports Medicine : https://pubmed.ncbi.nlm.nih.gov/30374942/

### L4 – Alcool → VFC, FC de nuit, sommeil

**Ce que dit la recherche**
- Grande étude intra-individuelle (Pietilä et al. 2018, 4 098 personnes, premières heures de sommeil), en comparant chaque personne à elle-même :
  - faible dose (≤ 0,25 g/kg) : rMSSD −2,0 ms, FC +1,4 bpm ;
  - dose modérée (0,25 à 0,75 g/kg) : rMSSD −5,7 ms, FC +4,0 bpm ;
  - forte dose (> 0,75 g/kg) : rMSSD −12,9 ms, FC +8,7 bpm.
- Étude Whoop 2026 (près de 21 000 personnes, plus de 5 millions de jours) : effets dépendants de la dose sur la FC de nuit, la VFC, la durée du sommeil et l'activité du lendemain, même à faible dose. Par verre supplémentaire chez les hommes : environ +2,4 bpm et −3,3 ms (chiffres rapportés par la presse).
- Effet plus marqué chez les jeunes adultes ; boire plus tôt dans la journée atténue l'effet.

**Délai** : la nuit même (J+1 dans Aube) ; retour à la normale rapide, effet résiduel possible à J+2.

**Niveau de preuve** : fort.

**Valeur de départ pour Aube** (le journal note l'alcool en oui / non)
- VFC de la nuit : −5 ms (écart-type 5 ms).
- FC de nuit : +3 bpm (écart-type 2,5 bpm).
- Durée du sommeil : −10 min (écart-type 20 min).
- J+2 : 0 (écart-type 3 ms).
- Si un jour le journal note le nombre de verres (10 g d'alcool par verre) : par verre, −2 ms (écart-type 1,5) et +1,5 bpm (écart-type 1).
- Garde-fou : un effet positif de l'alcool sur la récupération est « inattendu ». Explication probable : je bois surtout les jours de repos. On l'ajuste sur la charge du jour.

**Ce qui reste incertain** : Pietilä mesure les 3 premières heures de sommeil ; la VFC de Zepp couvre toute la nuit, ce qui dilue l'effet.

**Références**
- Pietilä et al. 2018, JMIR Mental Health : https://pmc.ncbi.nlm.nih.gov/articles/PMC5878366
- Grosicki et al. 2026, PLOS Digital Health (Whoop) : https://pmc.ncbi.nlm.nih.gov/articles/PMC12970902/
- Effet de la dose sur la régulation cardiaque pendant le sommeil (Sleep 2021) : https://pmc.ncbi.nlm.nih.gov/articles/PMC7819834

### L5 – Caféine tardive → sommeil

**Ce que dit la recherche**
- Méta-analyse de 24 études (Gardiner et al. 2023) : la caféine réduit le sommeil de 45 min et son efficacité de 7 %, allonge l'endormissement de 9 min et les réveils de 12 min ; le sommeil profond baisse d'environ 11 min.
- Heures limites calculées : un café (environ 107 mg) au moins 8,8 h avant le coucher ; un pré-entraînement (environ 218 mg) au moins 13,2 h avant ; un thé (environ 47 mg) jusqu'au coucher.
- La demi-vie de la caféine varie de 2 à 10 h selon les personnes : la limite idéale est personnelle.
- Essai de 2025 : 100 mg jusqu'à 4 h avant le coucher sans effet net ; 400 mg dans les 12 h dérangent le sommeil.

**Délai** : la nuit même.

**Niveau de preuve** : fort.

**Valeur de départ pour Aube** (le journal note la caféine ; à préciser : « caféine après 14 h » si je me couche vers 23 h)
- Durée du sommeil : −30 min (écart-type 25 min). Plus prudent que la méta-analyse, qui inclut de fortes doses.
- VFC : 0 (écart-type 5 ms), pas de preuve directe.
- Mon heure limite personnelle peut être estimée plus tard avec une expérience (lot 5e).

**Références**
- Gardiner et al. 2023, Sleep Medicine Reviews : https://pubmed.ncbi.nlm.nih.gov/36870101/ et https://eprints.leedsbeckett.ac.uk/id/eprint/9625/
- Heures limites par boisson (thèse ACU) : https://acuresearchbank.acu.edu.au/item/9106w/investigating-the-effects-of-psychoactive-substances-on-subsequent-sleep
- Dose et heure de prise, essai 2025 : https://pmc.ncbi.nlm.nih.gov/articles/PMC11985402/

### L6 – Heure du coucher → durée du sommeil

**Ce que dit la recherche**
- La plupart des actifs se lèvent avec un réveil : un coucher plus tardif raccourcit alors directement la nuit les jours travaillés, et la dette se rattrape le week-end (« décalage social », Roenneberg).
- Les personnes du soir accumulent le plus de dette en semaine.

**Délai** : la nuit même.

**Niveau de preuve** : moyen (mécanisme simple, études surtout par questionnaire).

**Valeur de départ pour Aube**
- Séparer jours travaillés et jours libres (le week-end comme approximation, ou une étiquette).
- Jours travaillés : −45 min de sommeil par heure de coucher plus tardive (écart-type 15 min).
- Jours libres : −15 min par heure (écart-type 20 min).
- Remplacer la coupure à la médiane par une courbe dose–effet (lot 5b).

**Références**
- Wittmann, Roenneberg et al. 2006, le décalage social : https://pubmed.ncbi.nlm.nih.gov/16687322/
- Roenneberg 2023, Nature Reviews Endocrinology : https://www.nature.com/articles/s41574-023-00851-2.pdf

### L7 – Régularité du coucher → VFC, énergie

**Ce que dit la recherche**
- La régularité du sommeil prédit la mortalité plus fortement que sa durée (Windred et al. 2024, 60 977 personnes). Le risque augmente nettement pour les sommeils les plus irréguliers (Cribb et al. 2023).
- Ces études portent sur la santé à long terme ; je n'ai pas trouvé d'étude solide sur l'effet d'une semaine irrégulière sur la VFC du lendemain.

**Niveau de preuve** : fort pour la santé à long terme, faible pour l'effet de jour en jour.

**Valeur de départ pour Aube**
- Mesure : écart-type de l'heure du coucher sur les 7 derniers jours.
- Effet sur la VFC et l'énergie : 0, avec un écart-type large (sens attendu : négatif). Mes données décideront.
- Indépendamment de tout lien, la régularité peut être affichée comme un repère en soi.

**Références**
- Windred et al. 2024, Sleep : https://pmc.ncbi.nlm.nih.gov/articles/PMC10782501/
- Cribb et al. 2023, eLife : https://pubmed.ncbi.nlm.nih.gov/37995126/

### L8 – Dette de sommeil → force, énergie

**Ce que dit la recherche**
- Restreindre le sommeil à 6 h pendant 14 jours crée des déficits qui s'accumulent jour après jour, alors que la somnolence ressentie se stabilise vite : on ne se rend pas compte de la dette (Van Dongen et al. 2003).
- Méta-analyse de 69 études (Craven et al. 2022) : une nuit courte (≤ 6 h) baisse la performance physique d'environ 7,6 % en moyenne, la force d'environ 2,9 %. Se réveiller plus tôt que d'habitude pèse plus que se coucher plus tard.

**Délai** : lendemain pour la performance ; cumul sur plusieurs jours pour la dette.

**Niveau de preuve** : fort.

**Valeur de départ pour Aube**
- Nuit de moins de 6 h, ou 1 h sous ma norme : force estimée (1RM) de la séance suivante −3 % (écart-type 3 %).
- Énergie du matin : −0,5 point sur 5 (écart-type 0,5), preuve faible.
- Conséquence : la dette se calcule sur plusieurs nuits (lot 6) et l'app ne compte pas sur le ressenti pour la signaler.

**Références**
- Van Dongen et al. 2003, Sleep : https://pubmed.ncbi.nlm.nih.gov/12683469/
- Craven et al. 2022, Sports Medicine : https://pmc.ncbi.nlm.nih.gov/articles/PMC9584849/

### L9 – Temps d'écran du soir → heure du coucher → sommeil

**Ce que dit la recherche**
- Méta-analyse de 21 cohortes (548 338 personnes, 2025) : chaque heure d'écran supplémentaire retarde le coucher d'environ 13 min et augmente le risque d'insomnie.
- Méta-analyse de 2024 : lien modeste entre usage des écrans et moins bon sommeil (corrélation de 0,28 à 0,33). Le retard du coucher est l'un des mécanismes proposés.

**Délai** : la nuit même.

**Niveau de preuve** : moyen (études surtout observationnelles et entre personnes).

**Valeur de départ pour Aube** (collecte au lot 5d)
- Heure de coucher : +13 min par heure d'écran après 21 h (écart-type 10 min).
- Effet direct sur la durée ou la VFC, à heure de coucher égale : 0 (écart-type 10 min).
- Analyse prévue : médiation écran → coucher → sommeil.

**Références**
- He et al. 2025, Frontiers in Psychiatry : https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12754674/
- Han et al. 2024, JMIR : https://www.jmir.org/2024/1/e48356

### L10 – Dernier repas tardif → FC de nuit, réveils

**Ce que dit la recherche**
- Enquête sur 793 jeunes adultes : manger dans les 3 h avant le coucher est associé à plus de réveils nocturnes (rapport de cotes 1,61), sans effet net sur l'endormissement ni la durée.
- Essai de 2026 (39 adultes en surpoids, 7,5 semaines) : arrêter de manger 3 h avant le coucher a baissé la FC de nuit d'environ 5 % et la tension de nuit de 3,5 %.
- Des repas décalés tard déplacent le rythme quotidien de la FC et de la VFC de 1 à 4 h (petite étude de 2013).
- Point bas de la FC de nuit : idée répandue (un point bas tardif signalerait une digestion ou une récupération qui déborde), mais je n'ai pas trouvé d'étude solide qui le valide. Indicateur exploratoire.

**Délai** : la nuit même.

**Niveau de preuve** : faible à moyen.

**Valeur de départ pour Aube**
- Dernier repas moins de 3 h avant le coucher : FC de nuit +2 bpm (écart-type 2), VFC −2 ms (écart-type 5).
- Point bas de la FC de nuit : aucune valeur de départ, affiché seulement en détail tant que mes données ne montrent pas un lien stable.
- **Heure du repas** : l'heure transmise par Suivi macro est bien l'heure du repas, pas celle de la saisie (confirmé le 24 novembre 2026). Le dernier repas du jour se calcule donc directement à partir des repas lus dans Health Connect.

**Références**
- Chung et al. 2020, IJERPH : https://pmc.ncbi.nlm.nih.gov/articles/PMC7215804
- Essai 2026, Arteriosclerosis, Thrombosis, and Vascular Biology (résumé presse) : https://www.healthday.com/health-news/nutrition/skipping-a-late-night-snack-pays-big-benefits-for-your-heart
- Repas décalés et rythme de la FC (2013) : https://pubmed.ncbi.nlm.nih.gov/23685233/

### L11 – Protéines → force et masse maigre

**Ce que dit la recherche**
- Méta-analyse de 49 essais (Morton et al. 2018) : un apport supplémentaire en protéines augmente les gains de force (1RM +2,5 kg) et de masse maigre (+0,3 kg) sur des programmes d'au moins 6 semaines. Au-delà d'environ 1,6 g/kg/jour, pas de gain supplémentaire de masse maigre.
- Méta-analyse de 74 essais (2022) : effet sur la masse maigre chez les moins de 65 ans à partir de 1,6 g/kg/jour.
- Je n'ai pas trouvé de preuve solide d'un lien entre protéines d'un jour et courbatures du lendemain.

**Délai** : semaines à mois.

**Niveau de preuve** : fort pour le seuil de 1,6 g/kg, faible pour un effet de jour en jour.

**Valeur de départ pour Aube**
- Repère : moyenne de la semaine ≥ 1,6 g/kg/jour (la cible des Réglages reste la mienne).
- Lien « protéines → récupération du lendemain » : valeur de départ 0, écart-type large ; à rétrograder en simple détail s'il ne montre rien après 60 jours.
- Analyse utile : semaines au-dessus ou en dessous du repère face à la progression de la force sur plusieurs mois.

**Références**
- Morton et al. 2018, British Journal of Sports Medicine : https://pubmed.ncbi.nlm.nih.gov/28698222/
- Nunes et al. 2022, Journal of Cachexia, Sarcopenia and Muscle : https://pubmed.ncbi.nlm.nih.gov/35187864/

### L12 – Calories mangées et tendance du poids → calories de maintien

**Ce que dit la recherche**
- La règle « 7 700 kcal = 1 kg » surestime la perte de poids sur la durée, car la dépense s'adapte (Hall).
- L'énergie d'un kilo perdu ou gagné dépend de sa composition : environ 39,5 MJ/kg pour la graisse (environ 9 400 kcal), environ 7,6 MJ/kg pour la masse maigre (environ 1 800 kcal).

**Niveau de preuve** : fort pour la physiologie ; la méthode d'estimation individuelle est une application.

**Valeur de départ pour Aube**
- Fenêtre glissante de 21 à 28 jours ; poids lissé (moyenne mobile exponentielle) ; 7 700 kcal/kg comme valeur moyenne, avec une fourchette.
- Jours exclus : saisie des repas incomplète (moins de 2 repas, ou calories inférieures à la moitié de ma médiane), jours étiquetés.
- Ordre de grandeur de l'incertitude : 0,5 kg d'eau en plus ou en moins sur 21 jours fausse l'estimation d'environ 180 kcal par jour (0,5 × 7 700 / 21) ; sur 28 jours, environ 140 kcal. On affiche donc une fourchette, jamais un chiffre seul.
- Valeur de départ : ma moyenne de calories mangées sur la fenêtre (hypothèse de poids stable).

**Références**
- Hall 2008, International Journal of Obesity : https://pmc.ncbi.nlm.nih.gov/articles/PMC2376744
- Hall et Chow 2013 : https://pmc.ncbi.nlm.nih.gov/articles/PMC3859816
- Thomas et al., modèle dynamique contre règle des 7 700 kcal : https://pmc.ncbi.nlm.nih.gov/articles/PMC4024447

### L13 – Durée du jour → sommeil

**Ce que dit la recherche**
- En laboratoire, des journées courtes allongent fortement le temps de sommeil (Wehr 1991).
- En ville, avec la lumière artificielle, l'effet est discuté : une étude par bracelets sur une année trouve une baisse modeste de la durée du sommeil quand les jours rallongent, et des réveils plus tôt au printemps.

**Délai** : semaines (effet de saison).

**Niveau de preuve** : faible pour un effet chiffrable en milieu urbain.

**Valeur de départ pour Aube** (lot 6)
- Effet par heure de jour en plus : 0 (écart-type 10 min de sommeil) ; sens attendu : légèrement négatif.
- Retirer la tendance saisonnière avant tout autre lien ; présenter un résultat seulement après plusieurs mois couvrant des durées du jour différentes.

**Références**
- Mattingly et al. 2021, npj Digital Medicine – saisons et sommeil mesurés par bracelets : https://pmc.ncbi.nlm.nih.gov/articles/PMC8080821
- Synthèse sur la variation saisonnière, dont Wehr 1991 : https://www.proquest.com/docview/2777162798

### L14 – FC au repos, respiration, température → maladie

**Ce que dit la recherche**
- Montres connectées et COVID-19 (Mishra et al. 2020) : une hausse de la FC au repos a permis de repérer 63 % des cas avant les symptômes ; quelques-uns 9 jours ou plus avant.
- Système d'alerte en temps réel (Alavi et al. 2022), avec un algorithme de dérive (CUSUM) sur la FC au repos : environ 80 % des cas repérés avant ou au début des symptômes, signal médian 3 jours avant. Il réagit aussi à d'autres stress (vaccination).
- Fréquence respiratoire de nuit (Natarajan et al.) : souvent en hausse pendant une infection ; normalement entre 11,8 et 19,2 par minute chez l'adulte en bonne santé ; une hausse d'au moins 3 par minute au-dessus de l'habitude est fréquente chez les malades.
- Fausses alertes connues : voyages, altitude, alcool, entraînement très dur, vaccination.

**Délai** : 1 à 3 jours avant les symptômes.

**Niveau de preuve** : fort pour l'existence du signal ; la précision pour une personne seule reste à mesurer.

**Valeur de départ pour Aube**
- Score d'écart combiné : FC au repos (en hausse), VFC (en baisse), et fréquence respiratoire et température si Zepp les écrit.
- Détection de dérive (CUSUM) ; signal seulement après 2 nuits de suite ; nuits avec alcool et jours de charge très élevée exclus.
- Évaluation : sur mes périodes « malade », combien de jours d'avance et combien de fausses alertes. Les épisodes sont rares : évaluation descriptive sur une année.
- Formulation : un signal de récupération, jamais un diagnostic.

**Références**
- Mishra et al. 2020, Nature Biomedical Engineering (résumé) : https://search.bvsalud.org/global-literature-on-novel-coronavirus-2019-ncov/resource/en/covidwho-933690
- Alavi et al. 2022, Nature Medicine : https://pmc.ncbi.nlm.nih.gov/articles/PMC8799466
- Natarajan et al. 2021, npj Digital Medicine – fréquence respiratoire : https://pmc.ncbi.nlm.nih.gov/articles/PMC8443549
- Natarajan et al. 2020, npj Digital Medicine : https://doaj.org/article/02b99d5ad127459fb9f207548d75cd8c

### L15 – Endurance (temps en zone 2) → FC au repos

**Ce que dit la recherche**
- Méta-analyse de 191 études (Reimers et al. 2018) : l'entraînement d'endurance baisse la FC au repos de 2,7 à 5,8 bpm selon le sexe ; la musculation seule n'a pas d'effet net. La baisse est plus forte chez ceux qui partent d'une FC élevée.

**Délai** : semaines à mois.

**Niveau de preuve** : fort pour des personnes non entraînées ; effet plus petit attendu chez moi, déjà actif.

**Valeur de départ pour Aube**
- Sur 12 semaines, +60 min par semaine en zone 2 : −1 bpm (écart-type 1,5).
- Analyse sur des données par semaine, jamais de jour en jour.

**Référence**
- Reimers et al. 2018, Journal of Clinical Medicine : https://www.mdpi.com/2077-0383/7/12/503

### L16 – Ressenti et score de récupération (validation du score)

**Ce que dit la recherche**
- Revue de 56 études (Saw et al. 2016) : les mesures ressenties (humeur, fatigue, stress perçu) suivent la charge d'entraînement avec plus de sensibilité et de régularité que les mesures objectives courantes, et les deux sont souvent peu corrélées entre elles.

**Niveau de preuve** : moyen à fort.

**Conséquences pour Aube**
- Le ressenti du matin n'est pas un simple contrôle du score : c'est un signal à part entière.
- Valeur de départ : corrélation entre score et énergie ressentie faible à modérée (0,1 à 0,3) ; entre score et écart de la force à sa tendance, faible.
- Si, après 60 jours, le score ne prédit ni l'énergie ni la force, on revoit sa composition, éventuellement en y intégrant le ressenti (décision au lot 5c, pas automatique).

**Référence**
- Saw et al. 2016, British Journal of Sports Medicine : https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708

---

## 4. Valeurs pour settings.ts

Noms proposés ; Claude Code les adapte aux conventions du fichier. Les effets sont exprimés « jour avec » moins « jour sans », sur ma propre échelle.

| Clé proposée | Valeur de départ | Écart-type | Unité | Fiche |
|---|---|---|---|---|
| `evidence.priorWeightDays` | 10 | — | jours équivalents | §1 |
| `evidence.hrvSwcFactor` | 0,5 × écart-type de ma moyenne sur 7 nuits (à défaut 3 %) | — | — | M2 |
| `evidence.hrvMinNightsPerWeek` | 3 | — | nuits | M2 |
| `evidence.fitnessFatigue.fatigueDays` | 7 (grille 1 à 10) | — | jours | L1 |
| `evidence.fitnessFatigue.fitnessDays` | 42 (grille 20 à 60) | — | jours | L1 |
| `evidence.fitnessFatigue.minDays` | 60 | — | jours | L1 |
| `evidence.sessionRpeDelayMin` | 30 | — | minutes après la séance | L2 |
| `evidence.lateIntenseSession.sleepMin` | −15 | 20 | min | L3 |
| `evidence.lateIntenseSession.hrvMs` | −2 | 5 | ms | L3 |
| `evidence.alcohol.hrvMs` | −5 | 5 | ms | L4 |
| `evidence.alcohol.nightHrBpm` | +3 | 2,5 | bpm | L4 |
| `evidence.alcohol.sleepMin` | −10 | 20 | min | L4 |
| `evidence.alcohol.hrvMsDay2` | 0 | 3 | ms | L4 |
| `evidence.caffeineLate.sleepMin` | −30 | 25 | min | L5 |
| `evidence.caffeineLate.hrvMs` | 0 | 5 | ms | L5 |
| `evidence.bedtime.workdaySleepMinPerHour` | −45 | 15 | min par heure | L6 |
| `evidence.bedtime.freedaySleepMinPerHour` | −15 | 20 | min par heure | L6 |
| `evidence.bedtimeRegularity.hrvMs` | 0 | 5 | ms par 30 min d'écart-type | L7 |
| `evidence.shortNight.strengthPct` | −3 | 3 | % de 1RM | L8 |
| `evidence.shortNight.energyPts` | −0,5 | 0,5 | points sur 5 | L8 |
| `evidence.screen.bedtimeMinPerHour` | +13 | 10 | min par heure | L9 |
| `evidence.screen.directSleepMin` | 0 | 10 | min par heure | L9 |
| `evidence.lateMeal.nightHrBpm` | +2 | 2 | bpm | L10 |
| `evidence.lateMeal.hrvMs` | −2 | 5 | ms | L10 |
| `evidence.lateMeal.hoursBeforeBed` | 3 | — | h | L10 |
| `evidence.protein.referenceGPerKg` | 1,6 | — | g/kg/jour | L11 |
| `evidence.maintenance.windowDays` | 21 à 28 | — | jours | L12 |
| `evidence.maintenance.kcalPerKg` | 7 700 | fourchette 1 800 à 9 400 | kcal/kg | L12 |
| `evidence.daylength.sleepMinPerHour` | 0 | 10 | min par heure de jour | L13 |
| `evidence.illness.consecutiveNights` | 2 | — | nuits | L14 |
| `evidence.illness.respRateRise` | 3 | — | respirations par minute | L14 |
| `evidence.zone2.restingHrBpmPer12Weeks` | −1 | 1,5 | bpm (pour +60 min/semaine) | L15 |

## 5. Garde-fous de plausibilité

| Lien | Sens attendu | Si mes données disent l'inverse |
|---|---|---|
| Alcool → VFC | baisse | « inattendu » ; deux fois plus de données ; ajustement sur la charge du jour |
| Alcool → FC de nuit | hausse | idem |
| Caféine tardive → sommeil | baisse | idem ; vérifier la définition de « tardive » |
| Nuit courte → force | baisse | idem |
| Charge → VFC à court terme | baisse | idem ; vérifier la fiabilité de la charge |
| Séance modérée le soir → sommeil | nul | pas de garde-fou : mes données décident |
| Régularité, durée du jour, protéines de jour en jour | incertain | pas de garde-fou : mes données décident |

## 6. Hors de ce référentiel

- Compléments alimentaires, exposition au froid, jeûne, respiration guidée, etc. : non évalués. Aucun lien sur ces sujets sans une fiche ajoutée ici d'abord.
- Les sources de marketing et les blogs de fabricants ne servent jamais de preuve. Exception notée : l'étude Whoop 2026 est publiée dans une revue à comité de lecture.
