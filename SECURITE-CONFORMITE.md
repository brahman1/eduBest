# EduBest — sécurité et préparation de l’exploitation

Mise à jour : le [rapport de sécurité actualisé le 21 octobre](AUDIT-SECURITE.md)
décrit les corrections et limites actuelles. Les nouveaux mots de passe utilisent
scrypt ; les anciens hashes bcrypt migrent à la connexion. La MFA des rôles
privilégiés est désormais imposée par le code en production.

Cette copie autonome hérite des contrôles techniques de Midad et les adapte à une école unique. Aucune certification de conformité ni sécurité absolue n’est annoncée.

## Contrôles présents

- Limitation à une seule école imposée par PostgreSQL ; création de compte propriétaire hors HTTP, transactionnelle et sans écrasement.
- Invitations réservées à la direction ; rôles séparés ; parents limités aux enfants associés, élèves à leur dossier et professeurs à leurs groupes.
- Hachage scrypt et migration bcrypt à la connexion, sessions hachées, cookies web HttpOnly/SameSite et Secure en production ; SecureStore sur les appareils natifs.
- Sessions limitées à sept jours et douze heures d’inactivité, révocation et confirmation récente d’identité pour les exports et actions sensibles.
- TOTP, secrets chiffrés AES-256-GCM, anti-rejeu, codes de secours hachés, rotation des sessions ; MFA exigée pour les rôles privilégiés dans la configuration Docker de production.
- Limites de requêtes persistantes, vérification des origines, CSP avec nonce neuf, protection contre l’intégration en iframe, limites de taille et vérifications des fichiers.
- Journal de sécurité sans contenu des dossiers, export personnel limité, demandes de droits et suivi par la direction. Marquer une demande traitée ne modifie pas automatiquement le dossier métier.
- Nettoyage des sessions/liens expirés ; journaux et notifications 180 jours ; file email sept jours, push trente jours ; demandes closes un an. Durées métier et rétention des sauvegardes à définir.
- Cookies, identifiants de paquets, sessions mobiles, clé serveur, ports et base indépendants de Midad. Aucun secret ou dossier réel de Midad n’a été copié.
- Mode fictif explicite et marqueur de démonstration pour empêcher d’insérer des données d’essai dans une école réelle déjà provisionnée.

## Avant de vrais dossiers

Compléter l’identité juridique et les coordonnées de l’école, les contacts de protection des données, les formalités applicables, les fondements de traitement, l’information des mineurs et représentants légaux, les contrats, les durées et les procédures de droits/incidents. Documenter l’hébergement réellement choisi, les prestataires et tout transfert international ; ne pas reprendre automatiquement les coordonnées d’hébergement de Midad.

Utiliser des comptes individuels et une clé `SECURITY_ENCRYPTION_KEY` aléatoire conservée dans un coffre. La perte ou le remplacement non préparé de cette clé bloque les secrets MFA. Ne pas mettre de secret dans `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.

Configurer le SMTP réel et la copie hors serveur des sauvegardes chiffrées, tester leur restauration sur le futur hébergement et organiser une revue indépendante de sécurité. Le serveur local et les comptes partagés fictifs ne conviennent pas à une exploitation réelle.

Les dépendances doivent être surveillées régulièrement. Les limites de la chaîne mobile héritée d’Expo, dont les dépendances de développement transitives, doivent faire l’objet d’une revue avant la signature et la publication natives. Le rapport de vérification décrit les contrôles réellement exécutés, sans assimiler un export JavaScript à une validation sur appareil.
