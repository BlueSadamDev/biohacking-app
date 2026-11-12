# Rapport du lot 0 – Données réellement disponibles

Date : 12 novembre 2026. Période inspectée : 30 derniers jours, via l'écran d'inventaire de l'APK de développement.
Ce rapport ne contient aucune valeur de santé : uniquement la présence des types de données et leur source.

## Constat principal

- **La HRV est disponible** dans Health Connect, écrite par **Zepp (Helio Strap)**. Le risque principal du cahier des charges (section 8) est levé.
- **La Suunto n'écrit rien dans Health Connect.** La connexion échoue du côté de l'app Suunto (problème externe à notre app, qui lit correctement les autres sources).
- **VO2max** n'est fourni par aucune source.

## Inventaire par type (Health Connect, 30 jours)

| Type | Zepp (Helio Strap) | Suunto | Remarque |
| --- | --- | --- | --- |
| Pas | ✔ | — | |
| Distance | ✔ | — | |
| Calories actives | ✔ | — | |
| Calories totales | ✔ | — | |
| Fréquence cardiaque | ✔ | — | |
| FC au repos | ✔ | — | Nombreux enregistrements par jour : la « valeur nocturne » est à extraire |
| HRV (rMSSD) | ✔ | — | Nombreux enregistrements par jour : la « valeur nocturne » est à extraire |
| Sommeil | ✔ | — | |
| Séances d'exercice | ✔ | — | |
| Dénivelé | ✔ | — | |
| SpO2 | ✔ | — | |
| VO2max | — | — | Aucune source |
| Poids | ✔ | — | Écrit par Zepp (probablement saisi dans l'app Zepp ou via une balance Zepp) |

## Conséquences et propositions de mise à jour du cahier des charges

1. **Section 2 (sources) et section 3 (fusion)** : tant que la Suunto ne se connecte pas, le **Helio Strap est la source unique** pour toutes les métriques. La table « prioritaire / secours » reste en place (réglage), la Suunto devenant le secours le jour où sa connexion fonctionne.
2. **Perdu sans la Suunto** : GPS, distance mesurée par GPS, type de séance détecté par la montre. Plan B à décider :
   - réessayer la connexion Suunto ↔ Health Connect plus tard (mises à jour de l'app Suunto) ;
   - import manuel des fichiers de séance (FIT/GPX) exportés depuis l'app Suunto, via un nouveau connecteur ;
   - API Suunto (programme partenaire, déjà cité dans le cahier des charges).
3. **Section 5 (indicateurs)** : HRV et FC au repos arrivent en **nombreux enregistrements par jour**. Il faut définir comment obtenir **une valeur par nuit**. Proposition : ne garder que les mesures prises pendant la session de sommeil, puis en prendre la moyenne de ln(rMSSD) pour la HRV et le minimum (ou la moyenne basse) pour la FC au repos. Paramètres à mettre dans `settings.ts`.
4. **VO2max** (F3, course) : indisponible. À retirer du lot concerné, ou à estimer plus tard (non prévu).
5. **Poids** : Zepp en fournit déjà. On peut lire le poids depuis Health Connect en plus de la saisie manuelle (à décider : quelle source prioritaire).
6. **Contrôle de cohérence entre capteurs** (section 3) : impossible sans la Suunto, à mettre en sommeil.

## Points à vérifier au lot 1

- Fréquence exacte des enregistrements HRV et FC au repos (pendant le sommeil uniquement, ou toute la journée).
- Contenu des sessions de sommeil (phases présentes ou non).
- Contenu des séances Zepp (type de sport, FC pendant la séance).
