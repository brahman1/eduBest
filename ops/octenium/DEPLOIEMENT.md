> 25 octobre 2026 : site public en ligne. Le serveur réel propose Node 22.23.4
> et PostgreSQL 16.15, validés avec 93 tests complets. Contact public :
> contact@edubest.dz. Lire ../../OCTENIUM.md pour l’état publié et le mode fermé
> de la gestion avant finalisation de la politique de conservation.

# EduBest — dossier Octenium prêt à configurer

Cible : edubest.dz, formule Professionnel, commande 364091408 payée pour 12 mois.
Dernier statut vérifié le 22 octobre 2026 : **en attente de validation**. Ce dossier
prépare l'installation ; il n'active pas le compte Octenium et ne constitue pas
une validation des capacités du serveur encore inaccessible.

## Informations publiques confirmées

- Marque : EduBest ; responsable légal : **KACI Belkacem**.
- Adresse communiquée : M’Chedallah centre, Algérie.
- Contact et confidentialité provisoires : **contact.edubest@gmail.com**.
- Site : https://edubest.dz ; API : https://api.edubest.dz/api.
- Les applications mobiles utiliseront https://edubest.dz/api, via le proxy du site.

## Vérifications immédiatement après activation

1. Accès cPanel/SSH, **Node 22.23.3 ou version 22 plus récente**, **PostgreSQL 16.15**
   minimum et mémoire suffisante pour deux processus Node. Le dossier utilise des
   modules Linux x64/glibc. Une autre architecture/version doit être validée avant
   usage. Les versions anciennes du tutoriel public Octenium ne suffisent pas.
2. Deux applications Passenger/Node distinctes, domaines edubest.dz et
   api.edubest.dz, application URL `/`, avec accès HTTPS valide. cPanel doit
   permettre les processus requis ; contrôler aussi les IP réellement vues par
   les limites de requêtes et la chaîne du proxy.
3. Base PostgreSQL neuve dédiée, nom exact et utilisateur fourni par cPanel,
   permissions, limites de stockage/connexions, outils pg_dump/pg_restore de la même version majeure que le serveur (16 ici).
4. SMTP authentifié, port 465/587, expéditeur autorisé, quotas et SPF/DKIM/DMARC.
   Le Gmail de contact public n'est pas automatiquement un identifiant SMTP.
5. Localisation réelle de l'hébergement et des sauvegardes, politique de
   conservation/fondements de traitement et stockage privé hors serveur à confirmer.

Le contrôle de préparation refuse une configuration incomplète. Ne pas remplacer
PostgreSQL par MySQL ni désactiver les vérifications pour forcer le démarrage.

## Installation après accord sur ces prérequis

Extraire l'archive dans **`/home/COMPTE/edubest-octenium`**, hors de public_html.
Les répertoires `runtime/` et `private/` ne doivent jamais être servis comme fichiers.
Ne pas déposer ce dossier complet dans public_html.

Dans l'environnement Node 22 choisi pour l'hébergement, préparer les fichiers
privés (adapter le chemin COMPTE, qui n'est pas encore connu) :

```sh
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs prepare --env-file /home/COMPTE/edubest-octenium/private/api.env
```

Cette commande génère deux clés distinctes, avec permissions privées, sans les
afficher. Elle refuse d'écraser un fichier existant et ne crée aucun compte.
Compléter `private/api.env` avec la base, SMTP, les informations d'hébergement,
conservation/fondements et le mot de passe initial choisi en privé. Ne pas envoyer
ces valeurs dans un chat ou un dépôt. Sauvegarder les clés dans un coffre.

`EDUBEST_CPANEL_ACCOUNT` doit être le nom exact du compte. Les noms autorisés sont
edubest/edubest_production ou COMPTE_edubest/COMPTE_edubest_production ; les bases
d'un autre compte, Midad et les bases de test sont refusées en production.

```sh
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs check --env-file /home/COMPTE/edubest-octenium/private/api.env --network
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs migrate --env-file /home/COMPTE/edubest-octenium/private/api.env
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs setup --env-file /home/COMPTE/edubest-octenium/private/api.env
```

Le premier contrôle ne modifie pas la base et n'envoie pas d'email ; il teste
l'authentification SMTP. Les migrations créent uniquement le schéma. `setup`
crée l'école et son premier responsable, sans élèves/cours/paiements fictifs,
et refuse d'écraser un établissement existant. Retirer ensuite
EDUBEST_ADMIN_PASSWORD du fichier privé, redémarrer l'API et activer la MFA.

Le fichier `database/schema-empty.sql` est une alternative à l'import du schéma
sur une base vide via phpPgAdmin. Ne pas l'importer après `migrate`, ni sur une
base contenant des objets. Il garde les versions des migrations synchronisées.
Il ne crée pas le compte de direction ; `setup` reste nécessaire.

## Applications cPanel

Créer/configurer les deux applications avec les chemins suivants :

| Application root, relatif au home | Domaine | Fichier de démarrage |
| --- | --- | --- |
| edubest-octenium/applications/edubest-api | api.edubest.dz | app.js |
| edubest-octenium/applications/edubest-web | edubest.dz | app.js |

Choisir **Production**, Node 22 à jour. Les racines Passenger contiennent uniquement
les démarreurs ; les dépendances précompilées sont à l'extérieur, dans `runtime/`,
pour ne pas écraser les répertoires virtuels node_modules créés par cPanel.
Si cPanel a généré un app.js d'exemple, conserver une copie puis remettre celui
de ce dossier. N'écraser aucune application/site déjà existant sans vérification.

Le site et l'API ont chacun un seul serveur HTTP : Passenger peut gérer leur
port. Ne pas lancer `serve-render.mjs` sous Passenger : il démarre deux processus
et cible un autre mode d'hébergement. Ne pas installer de licence cPanel/VPS
supplémentaire pour ces fichiers.

Vérifier les DNS de edubest.dz/api.edubest.dz, le certificat de chaque domaine et
l'absence de cache partagé sur les pages privées et `/api/*`. Le proxy web est
compilé vers https://api.edubest.dz ; changer cette adresse nécessite une nouvelle
compilation. Les informations privées ne sont pas intégrées dans le site.

## Emails, maintenance et sauvegardes

Passenger peut arrêter un processus inactif. Prévoir une tâche cron toutes les
minutes pour vider la file d'envoi même sans visiteurs (chemin Node exact fourni
par cPanel, après activation de son environnement) :

```sh
/CHEMIN/NODE22 /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs worker --env-file /home/COMPTE/edubest-octenium/private/api.env
```

La tâche est bornée et verrouillée contre ses chevauchements ; aucun endpoint
public de maintenance n'est créé. Contrôler les journaux et configurer les alertes.

Pour les sauvegardes, utiliser le même chargeur privé (donner un nom de sortie
unique pour chaque exécution, sans placer le mot de passe dans la commande) :

```sh
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs backup --env-file /home/COMPTE/edubest-octenium/private/api.env --output /home/COMPTE/edubest-backups/sauvegarde-DATE.edubest-backup
```

Le dump est chiffré AES-256-GCM. Sauvegardes privées hors serveur,
rétention, surveillance et restauration isolée sont à configurer chez l'hébergeur.
Une restauration n'accepte qu'une base vide edubest_restore_* ou
COMPTE_edubest_restore_* avec le préfixe explicite ; aucun écrasement automatique.

## Recette avant ouverture

```sh
node /home/COMPTE/edubest-octenium/runtime/api/ops/octenium/control.mjs smoke
```

Ce contrôle HTTPS vérifie pages publiques, notice réelle, absence de démo/cache
et refus des dossiers privés anonymes. Compléter avec connexion/MFA, invitation
et réinitialisation reçues réellement, rôles parents/élèves/enseignants, planning,
inscription/paiement, document, sauvegarde/restauration et essais sur téléphones.
Un contrôle local ne remplace pas cette recette sur le serveur effectivement fourni.

## Android/iOS

Les sources et profils Expo sont déjà dirigés vers edubest.dz. Les comptes
Expo/Google Play/Apple, projet EAS, configuration FCM/APNs et clés de signature
restent nécessaires pour les binaires finaux. Aucun APK de test ne doit être
publié. Le domaine doit répondre avant le build final et les notifications doivent
être testées sur appareil réel. Les alertes connues de l'outillage mobile restent
documentées dans LIVRAISON.md ; elles ne sont pas présentées comme corrigées.

Références : [Octenium Node.js](https://support.octenium.com/kb/comment-utiliser-une-application-node-js-sur-un-hebergement-cpanel-octenium/),
[cPanel Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/).
