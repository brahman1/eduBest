> Mise à jour du 25 octobre 2026 : site public publié sur https://edubest.dz,
> deux boîtes mail et schéma PostgreSQL installés. L’espace de gestion reste fermé,
> la conservation ayant été laissée « à définir » par l’établissement. Consulter
> OCTENIUM.md pour l’état actuel ; les constats datés ci-dessous sont historiques.

# EduBest — installation de production

Version de livraison : 22 octobre 2026. Lire d'abord `LIVRAISON.md` pour les
vérifications effectuées et les points dépendant des comptes du client.
Une seule école, devise DZD, fuseau Africa/Algiers, français/arabe.
Les sources de production ne chargent aucune donnée ni aucun compte fictif.

Pour Octenium / edubest.dz, consulter `ops/octenium/DEPLOIEMENT.md` et `OCTENIUM.md` : formule Professionnel payée, activation et compatibilité du serveur encore à confirmer.

## 1. Configuration de l'hébergement

Cette architecture nécessite un hôte Docker ou Node/PostgreSQL. Elle n'est pas
un déploiement direct sur Cloudflare Workers. Cloudflare peut fournir DNS/proxy
devant l'hébergement. Aucun achat ni abonnement n'est activé par les scripts.

Copier `ops/production.env.example` vers `ops/production.env` et remplir :

| Paramètres | Utilisation |
| --- | --- |
| DOMAIN, TLS_EMAIL | Domaine public et certificat HTTPS |
| POSTGRES_PASSWORD | Secret aléatoire hexadécimal d'au moins 48 caractères, base neuve dédiée |
| SECURITY_ENCRYPTION_KEY | 32 octets aléatoires encodés en 64 caractères hexadécimaux, secrets MFA et nouveaux emails en attente |
| SMTP_HOST/PORT/USER/PASSWORD/FROM | Fournisseur réel, port 465 ou 587, expéditeur vérifié |
| SCHOOL_LEGAL_NAME, SCHOOL_ADDRESS | Identité juridique et adresse de l'école |
| SCHOOL_CONTACT_EMAIL, SCHOOL_PRIVACY_EMAIL | Contacts publics ; le second utilise le premier s'il est vide |
| DATA_HOSTING_DESCRIPTION | Hébergement réel, prestataires email/push et transferts éventuels |
| DATA_RETENTION_POLICY, DATA_PROCESSING_BASIS | Politique de conservation, finalités et fondements retenus par l'école |
| EDUBEST_ADMIN_EMAIL/NAME/PASSWORD | Uniquement pour l'initialisation du premier responsable |

Le démarrage de production refuse les paramètres essentiels absents, les valeurs
d'exemple, les URL locales, le mode de démonstration et les bases/comptes de test.
Le contrôle ne valide pas à lui seul la disponibilité du domaine ni le bien-fondé
juridique de la politique renseignée. Ne pas importer une base `.local` ou Midad.
Le nom de base attendu est `edubest` ou `edubest_production`. Sur cPanel, le préfixe exact déclaré par EDUBEST_CPANEL_ACCOUNT autorise aussi COMPTE_edubest / COMPTE_edubest_production ; aucun préfixe implicite n’est accepté.

Générer chaque secret séparément dans un environnement privé avec, par exemple,
`openssl rand -hex 32`. Ne pas réutiliser la clé serveur comme clé de sauvegarde.
Protéger les fichiers privés par des permissions limitées et conserver les clés
dans un coffre avec copie de secours. La perte de la clé serveur empêche de
relire les secrets MFA et messages chiffrés. Ne pas la remplacer sans migration.

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production up -d --build
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production run --rm api node /app/scripts/setup-school.mjs
```

La seconde commande crée uniquement l'école et son premier responsable. Elle
refuse d'écraser une école ou un compte existant. Retirer ensuite le mot de passe
`EDUBEST_ADMIN_PASSWORD` du fichier privé et recréer l'API :

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production up -d --force-recreate api
```

Vérifier `docker compose ... ps` et les journaux sans les rendre publics.
Activer la MFA de la direction à la première connexion. Elle est obligatoire en
production pour OWNER, MANAGER et CASHIER. Conserver les codes de secours hors ligne.

PostgreSQL reste privé. Pour un serveur SQL distant, utiliser TLS avec validation
du certificat et du nom d'hôte. Le proxy doit conserver une chaîne d'IP de confiance
correcte pour les limites de requêtes. Ne pas exposer l'origine en contournant le
proxy. Avec Cloudflare, utiliser TLS avec validation de l'origine et exclure du
cache `/api/*`, `/app*`, `/auth*`, `/legal` et `/account-deletion`.

Les pages `/legal` et `/account-deletion` utilisent la configuration réelle.
Les réglages de confidentialité enregistrés par la direction complètent la notice ;
les vérifier avant ouverture et ne pas publier une adresse fictive.

### Variante Render

`render.yaml` conserve l'offre gratuite avec veille, sans création de base éphémère
ni fixtures. Il faut une nouvelle base persistante, le SMTP et tous les champs
d'identité requis. Aucun tarif ou dimensionnement d'hébergement n'est garanti par
cette configuration. Créer le premier responsable par commande d'administration
avec les variables `EDUBEST_ADMIN_*`, puis retirer le mot de passe d'initialisation.

## 2. Sauvegardes chiffrées et restauration

Créer **avant l'activation du profil backup** un fichier privé `ops/backup.key`
contenant une clé de 32 octets aléatoires en hexadécimal (64 caractères), distincte
de SECURITY_ENCRYPTION_KEY. Sous Linux, permissions 600 et répertoire de sauvegarde
privé 700. Aucun fichier contenant une clé n'est fourni dans l'archive.

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production --profile backup run --rm --build backup create /backups/edubest-AAAA-MM-JJ-01.edubest-backup
```

Choisir un nom unique à chaque exécution. Le dump est chiffré directement en flux
AES-256-GCM, avec IV aléatoire et contrôle d'intégrité. Aucun dump en clair n'est
créé pendant la sauvegarde. Un fichier existant n'est jamais remplacé. Les
sauvegardes contiennent les données conservées dans PostgreSQL, documents compris.

Profil facultatif pour une exécution quotidienne sur l'hôte :

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production --profile backup-scheduled up -d --build backup-scheduled
```

`EDUBEST_BACKUP_INTERVAL_SECONDS` vaut 86400 par défaut. Les échecs sont journalisés
et réessayés après une heure. Ce profil ne configure ni alerte externe ni rétention
ou copie hors serveur : l'hébergeur doit les organiser et surveiller l'espace.
Conserver la clé séparément des sauvegardes, tester régulièrement la restauration
et appliquer la politique de conservation validée par l'établissement.

Pour restaurer, créer une base **neuve et vide** nommée `edubest_restore_...` dans
un environnement isolé, accessible au conteneur backup, puis renseigner
`EDUBEST_RESTORE_DATABASE_URL` dans le fichier privé. Ne pas démarrer l'API dessus
avant restauration. Ne pas supprimer une base existante pour contourner le refus.

```sh
docker compose --env-file ops/production.env -f ops/compose.production.yml -p edubest-production --profile backup run --rm backup restore /backups/edubest-AAAA-MM-JJ-01.edubest-backup --confirm-empty
```

La vérification cryptographique complète précède pg_restore ; une copie temporaire
privée du dump déchiffré est utilisée pendant la restauration, puis supprimée.
Utiliser un disque temporaire protégé. Toute base contenant déjà des objets est
refusée. Le script n'efface ni ne restaure directement la production : après une
recette isolée, le basculement doit être organisé par l'administrateur.

Sans Docker : Node et les outils PostgreSQL 17 doivent être disponibles ; fournir
DATABASE_URL, EDUBEST_BACKUP_KEY_FILE et, pour restore, EDUBEST_RESTORE_DATABASE_URL.
Les commandes `npm run backup:create -- fichier.edubest-backup` et
`npm run backup:restore -- fichier.edubest-backup --confirm-empty` sont équivalentes.
Sous Windows, EDUBEST_PG_BIN peut préciser le dossier des outils PostgreSQL.

## 3. Android et iOS

Identifiant prévu : `dz.edubest.app`. Le valider avant première publication.
Renseigner dans l'environnement de build, sans secret dans EXPO_PUBLIC_* :

- EDUBEST_RELEASE=true
- EXPO_PUBLIC_API_URL : URL publique HTTPS terminée par `/api`
- EXPO_PUBLIC_WEB_URL : origine HTTPS du site, sans chemin
- EXPO_PUBLIC_EAS_PROJECT_ID : UUID du projet Expo
- GOOGLE_SERVICES_JSON : fichier Firebase Android privé fourni au build

Les profils de publication refusent les domaines locaux ou fictifs. Dans `mobile/`,
avec la CLI EAS officielle et les comptes/signatures déjà configurés :

```sh
eas build --platform android --profile production
eas build --platform android --profile production-apk
eas build --platform ios --profile production
```

Le premier produit l'AAB Google Play, le deuxième un APK de distribution directe.
Sauvegarder la clé d'upload et suivre la configuration de signature du compte de
publication. Pour iOS, les credentials Apple et un profil de distribution sont
nécessaires. Aucun compte n'est créé par cette livraison. Aucun forfait payant
ne doit être accepté sans validation du propriétaire.

Alternative Android locale sous Windows : JDK/Android SDK, rtk et dépendances
installés, puis `ops/build-android-release.ps1 -Format aab` ou `-Format apk`.
En plus des URL et du projet Expo, fournir EDUBEST_ANDROID_KEYSTORE_FILE,
EDUBEST_ANDROID_KEY_ALIAS, EDUBEST_ANDROID_STORE_PASSWORD,
EDUBEST_ANDROID_KEY_PASSWORD, EDUBEST_ANDROID_VERSION_CODE. Le script refuse les
valeurs absentes, vérifie la signature et place le fichier et son SHA-256 dans
`release/`, exclu du dépôt. Cette voie n'a pas été exécutée avec une clé du client.

Les notifications nécessitent la configuration Firebase/FCM côté Expo et, pour
iOS, APNs. Tester invitations, réinitialisations, login/MFA, notifications,
déconnexion, liens de confidentialité et suppression de compte sur appareils réels.
L'export JavaScript et l'APK local ne prouvent pas ces tests natifs.

## 4. Recette et exploitation

Avant ouverture : vérifier identité et notices, compte direction individuel, MFA,
emails réellement reçus, droits parents/élèves/enseignants, inscriptions, échéances
en DZD, paiements, planning avec fermetures, présences et documents. Vérifier
HTTPS, refus du cache privé, accès de l'origine, proxy/IP, sauvegardes et restauration.
Configurer les alertes, mises à jour, espace disque et procédure d'incident.

Les alertes mobiles non corrigées et les limites de validation sont détaillées
dans `LIVRAISON.md` et `AUDIT-SECURITE.md`. La sécurité technique ne remplace pas
les formalités, contrats et procédures applicables à l'établissement en Algérie.
Ni conformité légale complète ni protection absolue ne sont certifiées.
