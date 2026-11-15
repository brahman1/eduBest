> **26 octobre 2026 — candidat local non publié** : voir `CORRECTIONS-2026-10-26.md` et `verification/review-local-2026-10-26.json`. API/web et bundles mobiles reconstruits localement, 105 tests réussis. Les instructions historiques ci-dessous et les anciennes archives ne décrivent pas ce candidat. Aucune modification de la production effectuée pour ces corrections.

> Mise à jour du 25 octobre 2026 : site public publié sur https://edubest.dz,
> deux boîtes mail et schéma PostgreSQL installés. L’espace de gestion reste fermé,
> la conservation ayant été laissée « à définir » par l’établissement. Consulter
> OCTENIUM.md pour l’état actuel ; les constats datés ci-dessous sont historiques.

# EduBest — dossier de livraison du 22 octobre 2026

Les sources du site et des applications Android/iOS sont préparées pour la mise
en service d'une seule école en Algérie. L'archive de production ne contient ni
base de données, ni compte de démonstration, ni clé de signature, ni secret.
Elle doit être configurée avec les informations définitives de l'établissement.
**La mise en ligne publique et la livraison de binaires signés restent à réaliser.**

## Mise à jour du 22 octobre — dossier Octenium

Le domaine edubest.dz est actif et la formule Professionnel payée ; l’hébergement
attend encore sa validation, sans accès cPanel. Le profil utilise KACI Belkacem,
M’Chedallah centre et contact.edubest@gmail.com comme contact provisoire.
Voir `OCTENIUM.md` et `ops/octenium/DEPLOIEMENT.md`.

Le dossier Linux est compilé avec Node 22.23.3 et Next 16.4.2. Il prépare deux
applications Passenger distinctes, une base neuve, un profil privé, des clés
distinctes, une tâche emails et une sauvegarde chiffrée. Les noms de base cPanel
sont pris en charge sans autoriser les bases étrangères. Le schéma SQL alternatif
est testé sur une base isolée ; il contient seulement les migrations.

Les familles ne reçoivent pas les paramètres de rémunération des enseignants.
La suite complète passe avec 93 tests ; API/site recompilés et TypeScript
API/web/mobile/shared vérifié. Le rapport Linux `verification/octenium-linux-2026-10-22.json`
distingue la répétition locale de la recette encore requise chez Octenium.

## Ce qui a été vérifié

| Contrôle | Résultat constaté |
| --- | --- |
| Suite métier et sécurité sur la base isolée de test | 93 tests réussis, aucun échec |
| Installation propre et compilation des images API/site | Réussies, Node 22.23.3 |
| Démarrage des conteneurs en mode production | Réussi, base neuve sans école, compte ni élève ; API en lecture seule |
| Accès anonyme aux dossiers privés | Refusé |
| Notice et page publique de suppression de compte | Réponses valides et configuration d'identité vérifiée |
| Sauvegarde PostgreSQL chiffrée et restauration | Exécutées réellement sur la base isolée ; refus d'écrasement et d'archive altérée vérifiés |
| Export JavaScript Android/iOS/web | Réussi ; absence de braces et node-forge dans les trois bundles exportés |
| APK Android de recette locale | Reconstruit ; signature de développement, impropre à la publication |

Ces contrôles locaux ne remplacent pas la recette sur l'hébergement et sur des
téléphones physiques. Les rapports techniques sont conservés dans les sources
complètes, dossier `verification/`. Le manifeste de l'archive décrit son périmètre.

## Informations attendues de l'école et de l'hébergeur

- Activation/accès du serveur et compatibilité ; localisation des données et sauvegardes.
- Confirmer les informations publiques déjà fournies si elles changent ; le Gmail est provisoire.
- Prestataires email/push, finalités, fondements et durées de conservation retenus.
- SMTP et DNS expéditeur ; destination privée des sauvegardes hors serveur.
- Premier responsable : identité, email individuel et mot de passe choisi en privé.
- Projet Expo, compte Google Play, signature Android et Firebase ; compte Apple
  et signature iOS si la livraison iPhone est retenue.

Rien de tout cela n'est inventé dans la livraison. Les champs sont centralisés
dans `ops/production.env.example` et `mobile/.env.production.example`.
Les valeurs sensibles se transmettent via un coffre ou l'accès d'administration
de l'hébergeur, jamais dans le dépôt ni les variables publiques de l'application.

## Ordre de mise en service

1. L'hébergeur renseigne la configuration, crée les secrets distincts et déploie
   le site/API avec PostgreSQL privé et HTTPS, selon `PRODUCTION.md`.
2. Créer le premier compte de direction avec `setup-school.mjs`, retirer son mot
   de passe de l'environnement puis activer la MFA et conserver les codes de secours.
3. Vérifier les notices, emails réels, droits par rôle, planning et paiements ;
   tester une sauvegarde et sa restauration isolée sur l'hébergement retenu.
4. Construire l'AAB/APK signé avec les URL définitives et la configuration push.
   Tester sur Android physique avant remise au client ou envoi sur Google Play.
5. Construire et tester iOS avec les comptes Apple/Expo, puis soumettre si souhaité.
6. Valider l'exploitation : sauvegardes hors serveur, alertes, accès du responsable,
   documentation et procédure d'incident. Ouvrir ensuite aux dossiers réels.

## Réserves connues

La chaîne Expo/Metro conserve 15 entrées npm de sévérité haute propagées depuis
deux dépendances, `braces` et `node-forge`. Les versions publiées vérifiées sont
encore concernées, sans version corrigée annoncée dans les avis consultés.
Ces bibliothèques sont absentes des trois bundles JavaScript exportés contrôlés ;
cela ne prouve pas l'absence de toute faille dans le binaire natif ou les outils.
Les alertes restent ouvertes : compilation dans un environnement de confiance,
suivi des correctifs et réévaluation avant publication native. Aucun audit masqué
ni rétrogradation incompatible n'a été utilisé pour afficher un faux résultat sain.

Références : [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

Le domaine est actif ; le site, SMTP/FCM réels, sauvegardes distantes et WAF ne sont pas encore activés.
Aucun AAB/IPA final signé ni test sur téléphone physique n'est attesté.
Les formalités et contrats de l'établissement doivent être validés pour son
activité en Algérie ; le logiciel ne délivre pas une certification juridique ou
une garantie de sécurité absolue. La formule Professionnel a été payée par le client ; aucune option supplémentaire n’a été souscrite par les scripts.
