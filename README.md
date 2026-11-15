# EduBest

> **Version locale du 26 octobre 2026, non publiée** : [corrections, ordre de réalisation et recette](CORRECTIONS-2026-10-26.md). 105 tests isolés réussis ; migration 008 préparée, sans exécution sur Octenium. Le code local diffère actuellement de la version en ligne.

Dernière revue de sécurité : [audit et protections](AUDIT-SECURITE.md), incluant
les limites de validation et les réglages à faire chez l'hébergeur.

Projet autonome pour **une seule école privée**, dérivé de Midad le 15 octobre 2026. Le dépôt et le service Midad ne sont pas modifiés. Aucune copie de base, compte, clé, historique Git ou configuration Render de Midad n’est utilisée.

## Applications

- `web/` : site public de l’école et gestion Next.js, français/arabe, responsive.
- `api/` : API NestJS, PostgreSQL 17, authentification et autorisations.
- `mobile/` : application Expo / React Native commune à Android et iOS, identité `dz.edubest.app`, schéma `edubest://`.
- `shared/` : validations, rôles, calendrier et moteur de récurrence.

Fonctions conservées : élèves, liens parent/élève, inscriptions et capacité des groupes, enseignants, calendrier interactif, séries et vacances, présences/justificatifs, factures/versements/remboursements, caisse, rémunération des enseignants, documents, annonces, notifications, sécurité, demandes de confidentialité et exports. La programmation avancée des séries et le centre de sécurité s’ouvrent dans le web responsive ; ce n’est pas une promesse de parité de tous les écrans natifs.

## Une seule école

La migration `007-single-school.sql` limite PostgreSQL à une ligne dans `tenants` et à l’identifiant interne `edubest`. Le nom public et les coordonnées de l’école sont modifiables dans Réglages. Cet identifiant interne n’est demandé ni sur le web ni dans le mobile. `/api/auth/register` et l’ancien formulaire commercial sont supprimés. Les accès sont créés sur invitation par la direction. Le premier propriétaire est provisionné hors HTTP avec `npm run setup` ; l’opération refuse tout remplacement de compte existant, y compris sous concurrence.

**Utiliser une base vierge dédiée.** Le logiciel refuse de convertir implicitement une base appartenant à une autre école.

## Essai local

Prérequis : Node >=22.13 et Docker Desktop, ou PostgreSQL 17 installé sur Windows.

```powershell
npm ci
# Copier .env.example vers .env, créer SECURITY_ENCRYPTION_KEY aléatoire.
# Pour la démonstration uniquement : EDUBEST_DEMO_ENABLED=true.
npm run start:local
```

Le lanceur construit si nécessaire, applique les migrations et crée le jeu fictif uniquement si le mode démonstration est explicitement activé. `npm run start:local -- --rebuild` reconstruit après modification. Il ne remplace aucun processus occupant déjà ses ports. `Demarrer-EduBest.cmd` lance la même commande. `npm run stop:local` arrête uniquement les serveurs EduBest enregistrés ; la base est conservée.

| Service | Adresse locale |
|---|---|
| Site et gestion | http://127.0.0.1:3100 |
| API | http://127.0.0.1:4200/api |
| PostgreSQL | 127.0.0.1:5448, base `edubest` |
| Courriels fictifs Mailpit | http://127.0.0.1:8038 ; SMTP 1038 |
| Aperçu du code mobile | http://127.0.0.1:8095 après export et `npm run preview:mobile` |

Docker : `docker compose -p edubest -f ops/compose.local.yml up -d --wait`. Les volumes sont indépendants. Le repli Windows `ops/start-native.ps1` utilise PostgreSQL déjà installé et un cluster dans `.local/postgres`, lié uniquement à 127.0.0.1. Il crée aussi `edubest_test` pour les tests.

Sans Docker, placer le binaire Windows officiel [Mailpit](https://mailpit.axllent.org/docs/install/) dans `.local/mailpit/mailpit.exe` pour intercepter les emails. Aucun courrier de test n’est envoyé sur Internet. Sans SMTP, une invitation peut être enregistrée mais ne sera pas délivrée.

Les accès de démonstration sont consignés dans `ACCES-LOCAL.md`, ignoré par Git. Les scripts refusent d’ajouter des personnes fictives à une école initialisée hors démonstration.

## Première mise en service réelle

1. Préparer une autre base vierge, le domaine/HTTPS, l’email, une clé serveur aléatoire et les sauvegardes. Ne pas réutiliser le cluster fictif.
2. `EDUBEST_DEMO_ENABLED=false`. Renseigner provisoirement `EDUBEST_ADMIN_EMAIL`, `EDUBEST_ADMIN_NAME`, `EDUBEST_ADMIN_PASSWORD` dans l’environnement serveur, jamais dans une variable publique.
3. `npm run build`, puis `npm run setup`. Retirer ensuite `EDUBEST_ADMIN_PASSWORD` de l’environnement. Aucun mot de passe par défaut n’existe en exploitation.
4. Configurer l’école dans Réglages et Sécurité & confidentialité, activer la MFA, puis inviter l’équipe et les familles.

`ops/compose.production.yml` est une configuration Docker optionnelle, sans achat ni déploiement automatique. Démarrer la base, construire l’API puis utiliser le provisionnement dans son image. Fournir les trois variables `EDUBEST_ADMIN_*` dans l’environnement du terminal pour cette commande ponctuelle :

```powershell
docker compose --env-file ops/production.env -p edubest -f ops/compose.production.yml up -d db
docker compose --env-file ops/production.env -p edubest -f ops/compose.production.yml build api
docker compose --env-file ops/production.env -p edubest -f ops/compose.production.yml run --rm -e EDUBEST_ADMIN_EMAIL -e EDUBEST_ADMIN_NAME -e EDUBEST_ADMIN_PASSWORD api node /app/scripts/setup-school.mjs
docker compose --env-file ops/production.env -p edubest -f ops/compose.production.yml up -d --build
```

Le provisionnement applique les migrations puis crée le premier compte. Effacer ensuite les variables de bootstrap. Les images Docker n’ont pas été compilées sur cette machine ; les vérifications locales utilisent PostgreSQL natif à cause de l’échec de démarrage de Docker Desktop.

`render.yaml` prépare une **nouvelle démonstration gratuite indépendante**. Aucun service Render n’a été créé pour EduBest ; vérifier les quotas avant activation. Ne pas modifier le service Midad pour le réutiliser.

## Android et iOS

```powershell
npm run check
npm run export -w mobile
npm run dev:mobile
```

Pour un téléphone, configurer `mobile/.env.local` avec les URL d’EduBest (variables `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`). Une adresse 127.0.0.1 désigne le téléphone lui-même : pour les tests USB Android, utiliser `adb reverse tcp:4200 tcp:4200` et `adb reverse tcp:3100 tcp:3100`, ou configurer une adresse LAN accessible. Le SDK Android local permet une compilation sans EAS. `EduBest-Android-test-local.apk` est un APK de test signé avec une clé de développement, prévu pour les essais USB. Il ne doit pas être publié en boutique. Les builds iOS signés et les publications nécessitent l’environnement Apple et les comptes développeur correspondants ; ils ne sont pas réalisés par ce projet seul.

Le profil de production exige une API HTTPS et un identifiant de projet Expo indépendant. Ne pas réutiliser celui de Midad. Voir `mobile/eas.json`. Aucun service payant ou compte de store n’a été activé.

## Vérifications

`npm run check`, `npm run build`, `npm run export -w mobile`, `npm run format:check`.

`npm test` nécessite une API de test isolée et PostgreSQL **nommé `edubest_test`**, `DATABASE_URL` pointant sur cette base et `EDUBEST_TEST_DATABASE=true`. Les fixtures tronquent exclusivement cette base explicitement activée, jamais `edubest`. API : `TEST_API_URL`, site : `TEST_WEB_URL`, Mailpit : `TEST_MAIL_URL`. Tests séquentiels pour le modèle d’école unique. Voir `verification/RESULTATS.md` pour les résultats effectivement constatés.

## Sécurité et exploitation

Voir `SECURITE-CONFORMITE.md`. Le nom légal et l’adresse de l’école, l’hébergement réel, le SMTP, les contrats et la politique de conservation restent à compléter avec le propriétaire. La conformité de l’établissement et les disponibilités de production ne sont pas certifiées par la compilation du logiciel.


## Logo et icônes EduBest

Le logo commun et les formats Android/iOS/web se trouvent dans `branding/exports/`. Voir [le guide des icônes](branding/README.md). Régénération : `node scripts/generate-assets.mjs`, validation : `node scripts/verify-assets.mjs`.


## Identité visuelle actuelle

EduBest. et EB. remplacent le livre bleu/vert. Palette commune : bleu profond, bleu pâle et blanc cassé. Voir [la charte](CHARTE-GRAPHIQUE.md). `npm run brand:sync` synchronise les couleurs et les icônes web, Android et iOS.
