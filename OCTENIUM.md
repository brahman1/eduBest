> Mise à jour du 26 octobre 2026 : le parcours d’activation MFA est publié. Racine Passenger actuelle : `edubest-mfa-20261026/applications/edubest-web` ; démarreur `app-mfa-20261026.js` ; runtime `/home/ggcsckht/edubest-mfa-20261026/runtime/web/entry.cjs`. Les champs d’activation sont séparés de la confirmation sensible de dix minutes ; la gestion dirige les administrateurs non enrôlés vers la sécurité. Aucun changement API, base, comptes ou boîtes mail. Le propriétaire doit activer lui-même son application d’authentification. Validation : TypeScript, build Linux, six tests PostgreSQL isolés, parcours navigateur local simulé et empreinte SHA-256 du nouveau bundle public. Rapports `verification/mfa-student-regression-2026-10-26.json`, `verification/mfa-web-flow-2026-10-26.json`, `verification/mfa-live-2026-10-26.json`. Le parcours authentifié réel n’a pas été exécuté à la place du propriétaire.
>
> cPanel a conservé l’ancien processus après modification du seul démarreur ; la racine a donc été déplacée avec son outil Node.js. Attention : cet outil déplace aussi les fichiers et l’environnement Node ; la destination doit être absente pour éviter un déplacement partiel. Le conflit rencontré a été corrigé, puis la bascule et le site vérifiés. Les anciens démarreurs `app-contact-net.js` et `app-management.js` ont été déplacés par cPanel dans la nouvelle racine et restent disponibles ; l’ancien runtime `edubest-contact-net-20261025` reste intact pour retour arrière. Ne pas appliquer les anciennes racines des paragraphes historiques ci-dessous.

> Actualisation du contact technique du 25 octobre 2026 : contact@brainfor.net remplace contact@brainfor.fr en français et en arabe. Le site garde sa racine Passenger edubest-public/applications/edubest-web et utilise maintenant app-contact-net.js, qui charge /home/ggcsckht/edubest-contact-net-20261025/runtime/web/entry.cjs. Le démarreur précédent app-management.js est conservé. L’API, la base et les boîtes mail sont inchangées. Contrôles : verification/contact-technique-net-2026-10-25.json.

> Mise à jour du 25 octobre 2026 : la gestion est maintenant activée sur https://edubest.dz/auth. API HTTPS : https://api.edubest.dz. Un seul responsable OWNER a été créé pour contact.edubest@gmail.com après confirmation explicite. Aucun élève ou parent fictif ajouté. Le responsable définit son mot de passe via le lien envoyé par email, puis configure sa MFA obligatoire. La conservation demandée est une suppression manuelle lorsque les données ne sont plus nécessaires ; les durées comptables, la localisation physique et les formalités restent à finaliser. Les paragraphes de préouverture ci-dessous décrivent l’état antérieur. Lire verification/octenium-management-live-2026-10-25.json pour les contrôles actuels.

# EduBest — publication Octenium du 25 octobre 2026

Le site public répond sur **https://edubest.dz** et https://www.edubest.dz.
HTTP redirige vers HTTPS (301). Le compte Professionnel est actif sur le serveur
onyx.octenium.net, Node 22.23.4, PostgreSQL 16.15, Linux x86_64.

## Périmètre ouvert

Le site de présentation FR/AR, la notice et la page de préparation de l’espace
familial sont publiés. L’établissement a répondu **« à définir »** concernant la
conservation des dossiers/factures : **l’espace de gestion n’est pas ouvert**.
La version publique n’a pas de formulaire de connexion actif ; ses routes API
renvoient 503 et /app redirige vers /auth. Aucun dossier réel n’est collecté.
Ce mode ne contourne pas les validations du serveur de gestion complet.

Racine Passenger : `/home/ggcsckht/edubest-public/applications/edubest-web`,
fichier `app.js`, Node 22.23.4, Production. Les dépendances Linux précompilées sont
dans `edubest-public/runtime/web`, hors de public_html. Aucune variable privée
PostgreSQL/SMTP n’est fournie au processus web public.

## Base et messagerie

- Base dédiée `ggcsckht_edubest`, compte applicatif `ggcsckht_app` limité à cette base.
- Sept migrations appliquées. Zéro école, utilisateur, élève, groupe, facture et
  paiement dans les tables vérifiées. Le responsable sera créé à l’ouverture.
- phpPgAdmin a renvoyé une erreur serveur 500 ; l’installation a réussi via la
  tâche cPanel privée `prepare-schema`, sans endpoint public ni accès SSH.
- Dossier d’installation `/home/ggcsckht/edubest-private` : 0700 ; paramètres et
  script : 0600. Les identifiants restent hors code, archives publiques et dépôt.
- `contact@edubest.dz` et `notifications@edubest.dz` créés, 1 Go chacun.
  Authentification SMTP vérifiée en TLS sur mail.edubest.dz:465 ; aucun email envoyé.
- MX/SPF présents ; DMARC est en observation (`p=none`). La remise réelle et
  l’alignement DKIM/SPF restent à tester avant les envois aux familles.

## Vérifications

93 tests complets réussis sous Linux, Node 22.23.4, PostgreSQL/outils 16.15 après
correction des dépendances. Audit npm production API/web/shared : zéro alerte
connue le 25 octobre ; l’outillage mobile conserve ses réserves documentées.
La livraison inclut les dépendances propres au workspace API.

Site public : pages 200, CSP/HSTS/no-store présents ; absence de formulaire actif,
blocage des méthodes API, fichiers privés inaccessibles, aperçu arabe à 390 px
sans débordement horizontal. Rapport `verification/octenium-live-2026-10-25.json`.
Base réelle : `verification/octenium-schema-live-2026-10-25.json`.

## Avant l’ouverture de la gestion

Définir la politique de conservation et les fondements retenus par l’école,
confirmer la localisation/conditions de traitement des données et sauvegardes,
configurer les sauvegardes privées hors serveur et tester leur restauration.
Utiliser le livrable complet avec ses validations de production, initialiser le
responsable, activer sa MFA, tester les emails et les rôles sur l’hébergement.
Le build public a volontairement l’API fermée : un build complet est nécessaire
pour ouvrir la gestion, avec la configuration réelle validée.

Les comptes/signatures Expo/Google Play/Apple, FCM/APNs et essais sur téléphones
restent nécessaires pour les applications natives. Aucune publication sur les
stores, dépense supplémentaire ou communication au support n’a été effectuée.
