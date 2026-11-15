# EduBest : environnement de revue isolé

État au 29 octobre 2026. Ce document ne contient aucun mot de passe.

## Réalisé et vérifié localement

- Nouvelle base `edubest_review`, utilisateur PostgreSQL du même nom, sans superutilisateur, création de bases, création de rôles, réplication, bypass RLS ou appartenance à un autre rôle.
- Une seule école, slug interne `edubest`, exclusivement fictive.
- 76 élèves, 10 groupes, 85 séances et 56 paiements fictifs.
- Comptes direction, enseignant, parent et élève vérifiés par connexion à l’API. Le parent a deux enfants et l’élève son propre dossier.
- Un élève, parent ou enseignant ne peut pas lister les utilisateurs ou créer un groupe.
- Le rôle PostgreSQL de revue ne peut pas lire les tables de la base locale de l’école.
- Aucun SMTP ni push externe. Les notifications internes peuvent être consultées ; les tâches de livraison restent sans émission.
- Les clés, mots de passe et sessions sont indépendants de l’école.
- Le serveur refuse toute base autre que `edubest_review` ou le nom préfixé explicitement par le compte cPanel ; contrôle avant migrations et avant écoute HTTP. Le marqueur d’instance doit correspondre à la configuration privée.
- Aucune remise à zéro automatique. L’initialisation est refusée si la base n’est pas vide ; une instance déjà initialisée est préservée.
- 34 tests de politique/production et 24 tests mobiles passent, plus la recette API des quatre rôles.

## Android

Le code 2 déjà dans le brouillon Google Play ne contient PAS le sélecteur de démonstration.

Nouveau bundle : `release/EduBest-3.aab`, version 1.1.2, package `dz.edubest.app`, même certificat d’envoi. Bundletool, signature, manifeste, HTTPS, présence des deux services et alignement ELF 16 Ko vérifiés. Aucun téléversement Google Play effectué pour ce nouveau fichier.

APK signé à installer sur un téléphone : `release/EduBest-3.apk`. Compilation et vérification de signature réussies ; aucun test sur appareil physique à ce stade.

Le bouton « Essayer la démonstration » est visible à la connexion si les deux URL de revue sont configurées. La session de l’école n’est jamais envoyée au service de revue et inversement. Un changement n’est possible qu’après déconnexion ; les réponses de connexion anciennes sont rejetées après changement d’environnement. Une bannière indique les données fictives.

Pour la revue administrative uniquement, l’enrôlement MFA n’est pas obligatoire dans le serveur de revue, dont le démarrage est soumis aux contrôles de base/instance ci-dessus. La confirmation récente du mot de passe reste applicable aux opérations sensibles. La production de l’école conserve sa MFA obligatoire pour les administrateurs. Ce point doit être confirmé avant activation de la revue hébergée.

## Octenium : état réel

- Base vide créée : `ggcsckht_edubest_review`.
- Sous-domaines créés avec des racines distinctes : `demo.edubest.dz` et `demo-api.edubest.dz`.
- Paquet de code sans identifiants téléversé dans `/home/ggcsckht` : `EduBest-Demonstration-Octenium-20261029-r2.zip`, extrait et vérifié dans `edubest-review-20261029` (applications, runtime, initialisation et manifeste).
- Profil privé placé dans `/home/ggcsckht/edubest-review-private/api.env` ; permissions 600 du fichier et 700 du dossier vérifiées dans cPanel. L’archive intermédiaire `review-private.zip` reste hors des racines web avec permissions 600.
- L’utilisateur a créé `ggcsckht_edubest_revapp` et l’a associé à la seule base `ggcsckht_edubest_review` ; association vérifiée dans cPanel.
- L’utilisateur a confirmé explicitement l’activation des quatre comptes fictifs, dont l’administrateur de démonstration sans MFA obligatoire, les deux sous-domaines, les sorties externes désactivées et l’absence d’achat.
- Initialisation réussie par exécution MANUELLE du script `initialize-review` dans le gestionnaire Node.js. Aucune nouvelle tâche Cron créée. La tentative de création d’une tâche chaque minute a été rejetée automatiquement avant exécution et remplacée par cette commande ponctuelle.
- Quatre comptes vérifiés sur l’API et le proxy web de démonstration. Le parent distant dispose de trois enfants fictifs dans plusieurs groupes ; l’élève dispose d’un dossier.
- Les deux applications Node 22.23.4 Production de démonstration sont actives ; HTTPS valide et réponses 200 vérifiés. Le site et l’API réels répondent également toujours en HTTPS.
- Parcours parent vérifié visuellement dans le navigateur : école « EduBest · Démonstration », enfants, agenda, échéances et annonces fictifs.
- Aucune configuration, clé, racine d’application ou base de l’école réelle n’a été remplacée.

## Procédure serveur réalisée et étapes Android restantes

1. Utilisateur `ggcsckht_edubest_revapp` créé et association à la seule base `ggcsckht_edubest_review` vérifiée. Confirmation d’activation reçue avant création des comptes et exposition du service.
2. Profil privé déjà placé et permissions vérifiées. Ne jamais réutiliser `edubest-private/api.env`.
3. Paquet déjà extrait dans `/home/ggcsckht/edubest-review-20261029` ; ne pas écraser les applications de l’école.
4. Initialisation effectuée manuellement dans Node.js → application API de démonstration → Exécuter le script JS → `initialize-review`. Ce script vise exclusivement la nouvelle base et ne supprime aucune donnée préexistante. Aucun Cron n’est nécessaire. Les accès applicatifs sont écrits dans le dossier privé.
5. Deux NOUVELLES applications Node 22 Production créées, racines `edubest-review-20261029/applications/edubest-review-api` et `edubest-review-20261029/applications/edubest-review-web`, démarreur `app.js`, respectivement `demo-api.edubest.dz` et `demo.edubest.dz`. Les deux applications de production de l’école ne sont pas modifiées.
6. Certificats HTTPS valides et routage des deux sous-domaines vérifiés.
7. Recette distante : authentification et droits des quatre rôles, proxy web vers la démonstration, contrôle PostgreSQL de l’instance et des appartenances. Isolation des sessions mobile vérifiée par tests locaux ; aucun test volontaire d’envoi de jeton vers la production.
8. Installer l’APK code 3 sur un téléphone Android, tester les deux modes et les parcours des quatre rôles. Capturer uniquement des données fictives.
9. Fournir les identifiants et les instructions anglaises aux examinateurs via la rubrique restreinte Google Play. Ne pas publier les accès sur la fiche publique. Ne pas attester de l’accès complet avant la recette Android.
10. Remplacer le bundle code 2 du brouillon par le code 3 vérifié avant la soumission. Les URL de revue doivent fonctionner au moment de l’examen.

### Correction du nom PostgreSQL après le refus cPanel

Le profil privé a été corrigé localement ET sur le serveur pour `ggcsckht_edubest_revapp`, sans changer le mot de passe, les clés ou le nom de la base. cPanel attribue les droits par un rôle de base dédié `ggcsckht_edubest_review`. Le contrôle vérifie récursivement que seule cette appartenance existe, que les rôles n’ont pas de privilèges PostgreSQL administratifs, et qu’ils ne possèdent ni droit CREATE ni propriété sur une autre base. Toute autre appartenance est refusée.

Le paquet complet corrigé et réutilisable est `EduBest-Demonstration-Octenium-20261029-r4.zip`. Les versions r2/r3 ne doivent plus servir à une nouvelle installation.

Le web a nécessité une compilation Linux spécifique : les rewrites Next sont compilés avec `https://demo-api.edubest.dz`. Changer uniquement `API_INTERNAL_URL` au démarrage ne suffisait pas. Le runtime web actif est `/home/ggcsckht/edubest-review-web-20261029/runtime/web`, référencé par le démarreur de la nouvelle application web. L’API active reste dans `/home/ggcsckht/edubest-review-20261029/runtime/api` avec le contrôle cPanel corrigé.

Les APK/AAB code 3 n’ont pas besoin d’être reconstruits pour les corrections de noms PostgreSQL ou du web : ils utilisent déjà les deux URL de démonstration. Aucun test sur téléphone physique n’a été effectué ; aucune soumission Google Play du code 3 n’a été réalisée.

## Preuves et livraison

- `verification/review-public-live-20261029.json` : les quatre contrôles publics HTTPS (démonstration et disponibilité du site réel).
- `verification/review-roles-live-20261029.json` : quatre connexions fictives, droits par rôle et proxy web de démonstration. Aucun identifiant de production utilisé. Aucun test volontaire d’envoi de jeton à la production réalisé : cette transmission a été rejetée automatiquement et retirée du script de test.
- `verification/review-parent-live-20261029.png` : espace parent fictif vérifié visuellement.
- `verification/review-web-build-20261029.json` : routes web compilées exclusivement vers l’API de démonstration.
- `.local/review-octenium/ACCES-GOOGLE-PLAY-PRIVE.md` : identifiants applicatifs et instructions anglaises à remettre dans la rubrique restreinte de Google, jamais dans la fiche publique.

## Fichiers privés

- `.local/review/ACCES-REVUE-PRIVE.md` : comptes de l’instance LOCALE uniquement.
- `.local/review-octenium/CREATION-POSTGRES-PRIVEE.txt` : mot de passe PostgreSQL destiné à la saisie manuelle cPanel. Ce n’est PAS un compte applicatif à communiquer à Google.
- `.local/review-octenium/api.env` : profil distant préparé. Les comptes distants utiliseront son mot de passe applicatif propre, différent de celui de l’instance locale.
- Tous ces fichiers restent ignorés par Git, hors des archives publiques et hors des répertoires web.
