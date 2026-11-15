# EduBest — tableaux de bord personnels

Modifications locales du 27 octobre 2026. Aucun déploiement, email réel ou changement sur la base Octenium.

## Élève

- Prochain cours, y compris un cours en cours, avec matière, groupe, horaire, salle et enseignant.
- Agenda interactif des sept prochains jours, sélection d’une journée et accès à la fiche du cours.
- Annulations à venir dans cette semaine, notifications non lues, annonces des groupes autorisés et documents.
- Absences et statistiques personnelles ; échéances placées après les informations pédagogiques.

## Parent

- Vue de tous ses enfants, puis filtre nominatif avec couleur et niveau.
- Le filtre concerne les cours, les échéances, les absences, les statistiques et les annonces de groupe.
- Chaque cours indique les enfants de la famille concernés. Un cours partagé apparaît une seule fois.
- Les notifications appartiennent au compte parent et restent familiales : un libellé l’explique lorsqu’un enfant est sélectionné. Les anciennes notifications n’ont pas de métadonnée permettant de les attribuer de manière fiable à un enfant : aucune attribution n’est inventée.
- Aucun enfant lié : message invitant à contacter la direction, sans données de démonstration.

## Enseignant

- Prochain cours et agenda personnel avec groupe, salle et effectif inscrit.
- Accès direct à l’appel depuis une séance commencée ; les cours annulés ne proposent pas cette action.
- Liste des appels incomplets et des séances commencées à clôturer sur les trente derniers jours.
- Annonces, supports, rémunération du mois dans une section secondaire et statistiques de présence des élèves.

## Comportements communs

- Même sélection et règles de présentation sur le site et sur l’application React Native.
- Français et arabe, sens RTL, dates et horaires selon Africa/Algiers.
- Fiche de cours et lecture d’un message directement depuis l’accueil ; action explicite pour marquer une notification comme lue.
- Actualisation silencieuse de l’accueil chaque minute quand l’application est visible/active. Rafraîchissement au retour sur l’application ; sur le web, au retour du focus. Une panne de ce rafraîchissement silencieux conserve les dernières données. Le rafraîchissement manuel signale les erreurs.
- Fenêtre de données de l’agenda personnel : trente jours passés à quatre-vingt-dix jours à venir ; le planning complet conserve l’accès aux autres dates.
- Les données sont filtrées côté serveur avant d’arriver aux interfaces. Le sélecteur d’enfant constitue un filtre de présentation supplémentaire, jamais une autorisation.
- Les annulations reposent sur l’état réel des séances. Les autres changements ne sont signalés que si une notification existe : aucun historique de déplacement n’est inventé.

## Vérifications

- Vérification TypeScript : shared, API, web, mobile.
- Compilation API et compilation Next.js complète réussies.
- 11 tests ciblés réussis sur une base locale isolée `edubest_test` PostgreSQL 17 : isolation parent/élève/enseignant, deux enfants, affectation des cours, refus d’accès et de modification, lecture d’une notification, tri, filtres et heure d’Alger.
- 4 tests existants de calcul du calendrier réussis.
- Rendu HTML serveur des trois accueils en français/arabe et vérification existante des quatre rôles réussis. Ce contrôle ne remplace pas une recette visuelle interactive.
- Export Expo web, Android et iOS, avec bytecode Hermes mobile, réussi. Ce sont des bundles, pas des APK/AAB/IPA signés.
- Aucun test sur appareil physique, aucun test de réception push réel et aucun navigateur utilisé.

## Livraison ultérieure

Mettre à jour ensemble l’API et le site à partir de ces sources, puis reconstruire et distribuer l’application native. Cette évolution ne requiert pas de nouvelle migration SQL ; elle suppose que les migrations précédentes du projet sont déjà appliquées.

Le ZIP `EduBest-Octenium-MAJ-20261026-r1.zip` est antérieur à ces tableaux de bord : il ne contient pas cette évolution. Aucun nouveau ZIP de déploiement n’est fourni par cette modification. La configuration privée, les clés et les données existantes doivent être conservées.

Avant publication mobile : recette Android/iOS sur appareil pour les sélecteurs, le défilement, le lecteur de messages, les modales de cours, l’appel et les horaires en français/arabe.
