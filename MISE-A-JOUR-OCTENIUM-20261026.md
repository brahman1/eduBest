# EduBest — déployer les corrections du 26 octobre 2026 sur Octenium

Cette procédure met à jour le site et l’API existants. Elle ne recrée ni l’école, ni les comptes, ni la base et ne publie pas automatiquement les applications mobiles. Les chemins ci-dessous correspondent au dernier déploiement documenté ; vérifier les deux lignes dans cPanel avant de modifier des fichiers. Aucune étape de cette procédure n’a été exécutée sur l’hébergement pour préparer ce guide.

## 1. Les fichiers à utiliser

- **Mise à jour compilée Linux** : `EduBest-Octenium-MAJ-20261026-r1.zip`, préparée pour Node 22 et l’installation existante. Utiliser ce ZIP pour les étapes ci-dessous.
- **Sources** : `EduBest-corrections-locales-20261026.zip`. À conserver pour le développement et les futures compilations ; ne pas déposer son contenu directement dans public_html.
- Les binaires natifs Android/iOS doivent être reconstruits séparément après la mise à jour serveur, notamment parce que le module PDF a été ajouté.

Le ZIP de mise à jour crée uniquement un nouveau dossier `edubest-release-20261026-r1` contenant les runtimes et des démarreurs de référence. Il ne contient aucun fichier privé de connexion. Il ne remplace pas automatiquement les démarreurs actifs.

## 2. Relever la configuration actuelle

Ouvrir Octenium, l’hébergement puis cPanel, et **Setup Node.js App / Node.js**. Repérer les deux applications existantes :

| Service | Domaine | Application root attendue | Fichier de démarrage attendu |
| --- | --- | --- | --- |
| API | api.edubest.dz | `edubest-octenium/applications/edubest-api` | `app.js` |
| Web | edubest.dz | `edubest-mfa-20261026/applications/edubest-web` | `app-mfa-20261026.js` |

Le mode est **Production** et la version Node est **22.23.4** dans le dernier état vérifié. Une version 22 plus récente doit rester compatible avec les prérequis du projet. Ne pas sélectionner Node 18/20.

Faire une capture de chaque configuration. Si les chemins affichés diffèrent, employer les chemins effectivement affichés et vérifier leur démarreur ; ne pas déplacer des dossiers pour les faire correspondre au tableau. Le vieux chemin `edubest-public/applications/edubest-web`, encore présent dans certains anciens documents, n’est plus la racine web documentée.

**Ne pas modifier Application root, Application URL ni le nom du fichier de démarrage.** cPanel déplace aussi les fichiers et l’environnement Node quand la racine est changée ; ce déplacement n’est pas nécessaire pour cette procédure.

## 3. Sauvegarder avant de toucher à la production

Prévoir une courte interruption hors des heures d’utilisation et demander à l’équipe de ne plus saisir de données pendant la bascule.

1. Dans le gestionnaire de fichiers, télécharger une copie des deux démarreurs actifs du tableau. Conserver exactement leur contenu pour un retour arrière.
2. Sauvegarder les répertoires actifs et conserver les anciens runtimes sur le serveur.
3. Sauvegarder **PostgreSQL `ggcsckht_edubest`** avec ses données. Une copie des fichiers du site ne sauvegarde pas la base. Utiliser l’outil de sauvegarde PostgreSQL ou la sauvegarde complète proposée par cPanel si elle inclut effectivement PostgreSQL ; demander à Octenium de confirmer la sauvegarde/restauration si cette option n’est pas disponible.
4. Vérifier qu’un fichier de sauvegarde a été produit et qu’une restauration est possible. Si le projet dispose déjà de la clé de sauvegarde et des outils PostgreSQL configurés, la commande privée donnée à la fin du guide peut produire le dump chiffré.
5. Sauvegarder séparément, dans un emplacement privé, `/home/ggcsckht/edubest-private/api.env` et l’éventuelle clé `backup.key`. Ne jamais les déposer dans public_html ni les partager dans un message.

Ne pas commencer la migration sans sauvegarde PostgreSQL exploitable. En cas d’activité entre la première sauvegarde et l’arrêt de l’API, prendre une nouvelle sauvegarde après cet arrêt.

**Conserver sans changement** DATABASE_URL, SECURITY_ENCRYPTION_KEY, les identifiants SMTP et les comptes existants. Changer la clé de chiffrement rendrait les facteurs MFA et les anciens messages chiffrés illisibles.

## 4. Téléverser le ZIP sans changer le site actif

1. Dans cPanel → **Gestionnaire de fichiers**, cliquer sur **Accueil** pour atteindre `/home/ggcsckht`.
2. Cliquer sur **Téléverser**, sélectionner `EduBest-Octenium-MAJ-20261026-r1.zip`, attendre **100 %**.
3. Revenir au gestionnaire, cliquer sur **Recharger**, sélectionner ce ZIP puis **Extraire**.
4. Extraire dans le répertoire personnel courant : `/home/ggcsckht`. La destination affichée et le résultat doivent correspondre à ce dossier ; ne pas ajouter un deuxième niveau `edubest-release-20261026-r1` dans le champ d’extraction.
5. Vérifier la présence de ces fichiers :

```text
/home/ggcsckht/edubest-release-20261026-r1/
  runtime/api/api/dist/main.js
  runtime/api/api/migrations/008-delivery-and-role-policy.sql
  runtime/api/ops/octenium/api-entry.cjs
  runtime/web/entry.cjs
  runtime/web/web/server.js
  runtime/web/web/.next/static/
  reference/api-app.js
  reference/web-app.js
  MANIFEST.json
```

Activer « Afficher les fichiers masqués » dans les paramètres du gestionnaire si `.next` n’apparaît pas. Ne pas déplacer les fichiers cachés et ne pas copier node_modules depuis Windows : les dépendances Linux sont déjà incluses dans ce ZIP.

Le nouveau dossier doit être hors de public_html et de la racine publique du sous-domaine API. À ce stade, le site actif n’a pas changé.

## 5. Arrêter les deux applications le temps de la bascule

Dans **Setup Node.js App / Node.js** :

1. Ouvrir l’application `edubest.dz` et cliquer sur **Arrêter l’application**.
2. Ouvrir l’application `api.edubest.dz` et cliquer sur **Arrêter l’application**.

Le site sera temporairement indisponible. Ne pas recréer d’application Node et ne pas modifier les DNS. Si une nouvelle sauvegarde après arrêt est nécessaire, la réaliser maintenant.

## 6. Remplacer uniquement le contenu des deux démarreurs

### API

Dans le gestionnaire de fichiers, ouvrir :

```text
/home/ggcsckht/edubest-octenium/applications/edubest-api/app.js
```

Cliquer sur **Éditer**. Après avoir conservé l’ancienne version, remplacer le contenu entier par celui-ci, puis **Enregistrer** :

```js
"use strict";
process.env.EDUBEST_ENV_FILE = "/home/ggcsckht/edubest-private/api.env";
require("/home/ggcsckht/edubest-release-20261026-r1/runtime/api/ops/octenium/api-entry.cjs");
```

Le même texte est dans `reference/api-app.js`. Ce démarreur charge le fichier privé existant. Il ne contient aucun mot de passe.

### Web

Ouvrir :

```text
/home/ggcsckht/edubest-mfa-20261026/applications/edubest-web/app-mfa-20261026.js
```

Remplacer son contenu entier, après sauvegarde, puis **Enregistrer** :

```js
"use strict";
require("/home/ggcsckht/edubest-release-20261026-r1/runtime/web/entry.cjs");
```

Le même texte est dans `reference/web-app.js`. Le nom historique du démarreur reste identique ; c’est son contenu qui charge le nouveau runtime.

Ne pas lancer « Run NPM Install » : cette livraison contient ses dépendances compilées. Ne pas remplacer le fichier privé par `api.env.example`.

## 7. Démarrer l’API et appliquer la migration

1. Dans Node.js, ouvrir l’application API et cliquer sur **Démarrer l’application**. Si le bouton proposé est Redémarrer, utiliser ce bouton après avoir vérifié le contenu du démarreur.
2. Ouvrir `https://api.edubest.dz/api/public/health`. La visite peut déclencher le démarrage Passenger ; patienter pendant ce premier démarrage, puis actualiser si nécessaire.
3. Le programme applique les migrations manquantes **avant** d’ouvrir le serveur HTTP. La réponse attendue après réussite est :

```json
{"status":"ok"}
```

La migration 008 conserve les comptes et dossiers, retire les facteurs MFA des rôles non administrateurs, aligne les noms des dossiers liés sur leur compte et ajoute les données de suivi des envois. Elle conserve les facteurs MFA des administrateurs. Les anciens liens vers plusieurs dossiers ne sont pas supprimés arbitrairement : l’application demande une correction par la direction.

Si l’accès SQL privé est disponible, la vérification exacte est :

```sql
SELECT version, applied_at
FROM schema_migrations
WHERE version = '008-delivery-and-role-policy.sql';
```

Une ligne doit être retournée. Cette lecture est facultative si l’outil SQL n’est pas disponible ; garder la réponse health et vérifier les fonctions après démarrage web.

**Si health ne répond pas correctement**, garder le web arrêté et consulter le journal Passenger de l’API indiqué dans cPanel. Ne pas tenter de résoudre l’erreur en réimportant le schéma, en recréant la base ou en désactivant les protections. Une erreur de permissions de fichier privé impose de remettre `api.env` en **0600** et son dossier en **0700**, sans modifier les clés.

Ne jamais exécuter `setup`, `demo`, des fixtures ou `schema-empty.sql` sur cette installation existante. La migration normale suffit.

## 8. Démarrer le web

Quand l’API renvoie health correctement :

1. Dans Node.js, ouvrir l’application `edubest.dz` et cliquer sur **Démarrer l’application**.
2. Ouvrir `https://edubest.dz/auth`, puis `https://edubest.dz/api/public/health` ; le second doit aussi renvoyer `{"status":"ok"}`.
3. Faire un rechargement complet de la page (**Ctrl + F5** sur Windows) ou ouvrir une fenêtre privée. Un ancien onglet peut conserver l’ancien JavaScript.
4. Se connecter avec le compte administrateur existant ; ne pas créer un autre administrateur.
5. Vérifier que **Mon profil**, **Exports & bilans** et **Suivi des envois** apparaissent. Ce sont de bons repères du nouveau front.

Si l’ancien front reste visible après rechargement complet, vérifier le fichier réellement désigné comme démarreur, son contenu, puis arrêter/démarrer l’application concernée. Ne pas changer Application root et ne pas déplacer nodevenv. Une remise en service dans cette configuration doit être vérifiée sur le serveur ; le ZIP n’a pas encore été déployé pour prouver cette bascule réelle.

## 9. Mettre à jour la tâche de livraison des emails

Dans cPanel → **Tâches Cron**, chercher la tâche EduBest contenant `control.mjs worker`. Conserver une copie de sa commande, puis modifier la tâche existante plutôt que créer un doublon.

Fréquence : toutes les minutes, soit `* * * * *` dans les champs cron. Commande, avec le chemin Node de l’application API effectivement affiché dans cPanel :

```sh
/home/ggcsckht/nodevenv/edubest-octenium/applications/edubest-api/22/bin/node /home/ggcsckht/edubest-release-20261026-r1/runtime/api/ops/octenium/control.mjs worker --env-file /home/ggcsckht/edubest-private/api.env >> /home/ggcsckht/logs/edubest-worker.log 2>&1
```

Cette tâche permet de vider la file même lorsque Passenger suspend une API inactive. Si aucune tâche n’existe, en ajouter une seule avec cette fréquence, après vérification du chemin Node. Le répertoire logs doit exister et être accessible au compte cPanel. Ne pas changer les tâches d’autres projets. Les tâches de sauvegarde EduBest qui pointent sur l’ancien `control.mjs` doivent aussi utiliser le nouveau runtime, en gardant leurs paramètres privés et leurs destinations.

## 10. Vérifier les parcours avant de reprendre l’utilisation

Avec l’administrateur :

1. Ouvrir Mon profil et vérifier l’identité et le rôle.
2. Inviter un élève de recette avec une adresse que tu contrôles, ou utiliser un compte de recette clairement identifié. Vérifier qu’un seul dossier est créé automatiquement et que le nom est identique dans les deux listes. Compléter le dossier et l’inscrire à un groupe ; ne pas le recréer.
3. Avec ce compte élève, vérifier l’espace personnel, l’absence des menus administrateur et l’accès uniquement à ses propres données. Le parent voit uniquement ses enfants.
4. Vérifier que seuls OWNER/MANAGER demandent la 2FA ; parent, élève, enseignant et caissier ne doivent plus la demander.
5. Vérifier le libellé DA/séance, DA/heure ou %. Une séance doit être terminée pour compter dans la rémunération par séance/heure.
6. Créer une échéance de recette : PDF, email au parent vérifié ou à défaut à l’élève vérifié, et notifications des comptes associés.
7. Publier une annonce de recette pour le seul groupe de recette et vérifier que les autres élèves ne sont pas destinataires.
8. Confirmer son identité dans Sécurité, exporter un Excel et un JSON sur une période, puis ouvrir les fichiers. Les exports sont réservés aux administrateurs.
9. Vérifier les taux de présence sur les données existantes. Un tiret en absence d’appels renseignés n’est pas une erreur.

Identifier clairement les objets de recette et ne pas créer de paiements ou d’absences fictifs dans les dossiers réels. Ne pas supprimer des écritures financières réelles pour nettoyer un test. Pour une recette complète avec paiements/remboursements, employer une installation de recette séparée.

## 11. Vérifier les invitations Microsoft et les push

Les emails sont mis en file. Dans Suivi des envois, **SMTP accepté** signifie que le serveur SMTP a accepté le message, pas qu’Outlook l’a reçu. Tester une invitation vers une adresse Microsoft contrôlée, vérifier les indésirables et utiliser **Renvoyer l’invitation** pour générer un lien neuf si nécessaire.

En cas de refus 550/5.7.x, transmettre à Octenium le code et l’heure de l’échec, sans lien d’invitation ni mot de passe. Faire vérifier SPF, DKIM, DMARC, reverse DNS et réputation de l’IP d’envoi. Ne pas créer plusieurs enregistrements SPF concurrents et ne pas affaiblir l’authentification pour contourner un filtrage.

La boîte interne fonctionne indépendamment du push. Pour les alertes Android/iOS, le projet Expo et les identifiants FCM/APNs doivent être configurés et validés sur appareils physiques.

## 12. Mettre à jour l’application Android séparément

La mise à jour du serveur ne remplace pas l’application installée. Après la recette serveur :

1. Utiliser les sources corrigées et la configuration de production dirigée vers `https://edubest.dz/api` et `https://edubest.dz`.
2. Vérifier le projet Expo/EAS et les identifiants Android existants. Ne pas créer un deuxième package : conserver `dz.edubest.app` et, pour une application déjà publiée, la même identité de signature.
3. Reconstruire un APK de test interne avec le profil `production-apk` pour vérifier le PDF et les notifications ; le module `expo-print` impose une nouvelle compilation native.
4. Construire ensuite l’AAB avec le profil `production` pour Google Play, puis effectuer la publication via Play Console. Le profil incrémente la version de build via EAS.
5. iOS nécessite sa propre compilation/signature et publication. Un ZIP serveur ou un bundle JavaScript exporté n’est pas un binaire signé.

## 13. Si une étape échoue

- **Avant migration** : laisser les applications arrêtées, remettre exactement les deux anciens démarreurs sauvegardés puis redémarrer l’ancienne API et le web ; vérifier leur health.
- **Après migration** : les colonnes et les changements de politique/noms sont déjà dans la base. Remettre seulement l’ancien code ne rétablit pas la base ni les anciens facteurs MFA. Ne pas lancer de SQL inverse improvisé. Un retour strict à l’état précédent nécessite la sauvegarde PostgreSQL, les fichiers correspondants et une restauration contrôlée, avec les écritures arrêtées.
- Conserver les anciens runtimes et la sauvegarde jusqu’à validation réelle de cette version. Une restauration effacerait les saisies faites après sa sauvegarde : d’où l’interruption d’utilisation pendant la recette de bascule.

## Commandes facultatives si Terminal/SSH est disponible

Utiliser Node 22 depuis l’environnement de l’API. Ces commandes ne sont pas nécessaires pour l’application automatique de la migration au démarrage, mais offrent un contrôle explicite :

```sh
node /home/ggcsckht/edubest-release-20261026-r1/runtime/api/ops/octenium/control.mjs check --env-file /home/ggcsckht/edubest-private/api.env
node /home/ggcsckht/edubest-release-20261026-r1/runtime/api/ops/octenium/control.mjs check --env-file /home/ggcsckht/edubest-private/api.env --network
```

Le second vérifie aussi PostgreSQL et l’authentification SMTP, sans envoyer d’email. Pour une sauvegarde chiffrée, **uniquement si `backup.key`, sa variable privée et les outils PostgreSQL 16 sont déjà configurés**, choisir un nom de sortie jamais utilisé :

```sh
node /home/ggcsckht/edubest-release-20261026-r1/runtime/api/ops/octenium/control.mjs backup --env-file /home/ggcsckht/edubest-private/api.env --output /home/ggcsckht/edubest-backups/avant-maj-20261026-r1.edubest-backup
```

Une commande qui échoue ne constitue pas une sauvegarde. Conserver le fichier chiffré et sa clé séparément dans des emplacements privés. Ne pas recopier la clé dans la commande.
