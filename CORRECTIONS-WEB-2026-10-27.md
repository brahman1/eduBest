# EduBest — mots de passe, suppressions administrateur et logo

Changements préparés localement pour le site et son API, sans publication automatique.

## Mot de passe

- Minimum 8, maximum 128 caractères.
- Au moins cinq caractères différents (comparaison sans distinction majuscule/minuscule) ; mots de passe courants refusés.
- Chiffres, lettres et symboles recommandés ; aucune catégorie de caractère imposée. Les phrases françaises et arabes restent acceptées.
- Consignes affichées dans l’activation sur invitation, la réinitialisation et le changement de mot de passe. Validation du navigateur, du formulaire et du serveur cohérente.
- La connexion conserve la validation existante des anciens mots de passe : aucun changement forcé et aucun mot de passe réinitialisé.

## Suppression administrateur

- **Groupes & cours → Supprimer le cours** : retire le groupe actif et annule uniquement les séances futures non commencées. Inscriptions, présences, échéances, paiements et rémunérations historiques sont conservés.
- **Planning → détail d’une séance future → Supprimer cette séance** : annule la séance, sans effacement physique de l’historique. Les séances commencées et terminées ne sont pas supprimables par cette action.
- **Équipe & accès → enseignant → Supprimer l’enseignant** : désactive le compte, révoque les sessions/appareils/invitations et retire ses affectations futures. Les cours concernés restent programmés avec un enseignant à désigner. La direction doit les réaffecter.
- Le professeur retiré reste identifiable dans l’historique. Ses rémunérations demeurent consultables et les soldes historiques réglables.
- Confirmation explicite dans le formulaire, contrôle administrateur OWNER/MANAGER et confirmation d’identité récente côté serveur. Les autres rôles ne peuvent pas appeler ces actions.
- Les familles concernées reçoivent des notifications via les canaux configurés, au moment d’une vraie suppression. Aucun message réel envoyé pour les vérifications locales.
- Impossible de reprogrammer une nouvelle séance dans un cours retiré ou de remettre ses séances annulées en statut prévu tant que le cours reste archivé.

## Logo

Le logo du menu et celui de l’en-tête de l’espace connecté ouvrent `/app?view=dashboard`. Le menu utilise la navigation interne pour conserver la session. Le logo des pages publiques conserve le lien vers l’accueil public.

## Mobile et livraison

Les interfaces mobiles et l’AAB déjà remis ne sont pas reconstruits dans cette étape demandée pour le web. La politique de mot de passe est une règle serveur commune ; les libellés mobiles doivent être adaptés lors de la prochaine version mobile.

Aucune migration SQL supplémentaire n’est nécessaire : les champs d’archivage et de statut existent déjà. Déployer ensemble le site et l’API après sauvegarde, avec la configuration privée et la clé de chiffrement existantes. Les anciens ZIP et l’ancien AAB restent des livrables historiques.

## Vérifications

- TypeScript API/web et compilation web réussis.
- Dix tests ciblés réussis : mot de passe de huit caractères réel, ancien hachage et Unicode, droits, annulation future, retrait professeur, conservation de rémunération, règlement du solde historique, archivage du cours et préservation des échéances/présences.
- Tests effectués uniquement sur `edubest_test` PostgreSQL local, avec SMTP local sans destinataire réel.
