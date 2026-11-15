> Mise à jour du 25 octobre 2026 : site public publié sur https://edubest.dz,
> deux boîtes mail et schéma PostgreSQL installés. L’espace de gestion reste fermé,
> la conservation ayant été laissée « à définir » par l’établissement. Consulter
> OCTENIUM.md pour l’état actuel ; les constats datés ci-dessous sont historiques.

# EduBest — revue de sécurité, actualisée le 22 octobre 2026

Cette revue porte sur les sources EduBest, des requêtes réelles vers une API
locale et une base isolée `edubest_test`. Elle ne constitue ni un pentest
indépendant, ni une certification, ni une garantie contre toutes les attaques.
Midad et les bases locales contenant les démonstrations ne sont pas réinitialisés.

## Correction de confidentialité du 22 octobre 2026

La revue des rôles a révélé que les réponses groupes et séances transmettaient
les paramètres internes de rémunération aux familles, même si l'interface ne les
affichait pas. Les projections SQL PARENT/STUDENT utilisent désormais des listes
de champs explicites. Les échéances et l'export personnel sont également limités.
Les six scénarios ajoutés vérifient les cookies web et jetons mobiles, la portée
des dossiers, les refus d'accès/modification et le maintien des droits des équipes.
La suite complète passe : 93 tests. API/site reconstruits localement et paquet Octenium compilé sous Linux. Le rapport
verification/octenium-linux-2026-10-22.json décrit la recette locale ; Passenger
et les services réels d’Octenium restent à vérifier après activation.

## Corrections apportées

| Constat | Protection livrée |
| --- | --- |
| Exemptions MFA trop larges, notamment les invitations | MFA obligatoire en production pour OWNER, MANAGER et CASHIER, y compris invitations ; seules les routes de connexion déjà établies et de configuration nécessaires restent accessibles avant activation |
| Désactivation possible d'une MFA imposée | Désactivation refusée côté serveur pour ces rôles ; indication dans l'interface ; renouvellement des codes de secours avec mot de passe et facteur, révocation des anciens codes et autres sessions |
| Récupération déclenchable sans limite par adresse | Trois demandes par adresse et par heure, identique pour les adresses existantes et inconnues ; limites IP persistantes conservées |
| Un lien de vérification acceptait un nouveau mot de passe | Séparation des usages ; lien de vérification limité à l'email, reset à usage unique, révocation des sessions après reset |
| Mots de passe protégés par bcrypt | Nouveaux hashes scrypt N=32768, r=8, p=3, sel aléatoire 128 bits ; anciens bcrypt migrés à la connexion après authentification ; rejet des entrées bcrypt supérieures à 72 octets |
| Charges cryptographiques concurrentes | Deux opérations scrypt en parallèle au maximum, file de huit ; refus temporaire en surcharge ; aucun paramètre de coût fourni par le client ou le hash n'est exécuté arbitrairement |
| Changement de mot de passe conservant le même identifiant de session | Nouvelle session, révocation de toutes les anciennes, protection contre les changements concurrents, client mobile mis à jour |
| Invitations et réactivation de comptes | Confirmation récente de l'identité, quota d'invitations, vérifications des rôles et de l'école conservées |
| Liens d'accès lisibles dans les nouveaux emails en attente | Contenu du message chiffré AES-256-GCM avec la clé serveur et l'identifiant de message ; contenu et destinataire supprimés après envoi. Le destinataire reste lisible dans la file, les anciens messages de développement restent compatibles jusqu'à expiration |
| Consommation excessive des ressources | Délais HTTP, SQL, verrous, connexions SMTP et push bornés ; corps compressés refusés ; limites IP IPv6 regroupées par /56 ; quota documentaire de 100 Mo par école et limites de dépôts |
| Fichiers téléchargés | Authentification et portée du groupe, MIME/extensions/signatures, limite 5 Mo, téléchargement en pièce jointe et CSP sandbox ; ce contrôle n'est pas un antivirus |
| Investigation des erreurs difficile | Identifiant de requête généré par le serveur, présent dans la réponse et les erreurs internes ; aucune pile ni configuration sensible exposée au client |
| Configuration et chaîne de livraison | Node 22.23.3 configuré pour CI/Render/Docker ; conteneur API en lecture seule, privilèges retirés ; propositions de mises à jour Dependabot et CI à permissions réduites préparées |

Depuis la demande du 27 octobre 2026, les mots de passe nouveaux utilisent 8 à
128 caractères, dont au moins cinq caractères différents, sans obligation de
catégorie ; phrases arabes et longues acceptées. Une petite liste
locale bloque les choix les plus prévisibles et les répétitions. Ce n'est pas une
base exhaustive de mots de passe divulgués. Les mots de passe existants ne sont
pas changés en masse et ne sont jamais enregistrés en clair.

## Protections existantes conservées et revérifiées

Rôles et portée par enfant/groupe, SQL paramétré, validation des entrées,
cookies HttpOnly/Secure/SameSite, jetons hachés, origine vérifiée contre CSRF,
sessions à expiration et révocation, TOTP anti-rejeu, secrets MFA chiffrés,
CSP avec nonce et sans scripts inline libres, anti-iframe, refus du cache privé,
journal de sécurité, exports limités et absence de données fictives dans la livraison
de production.

## Vérification

La suite automatisée locale passe : 93 tests, dont les scénarios de sauvegarde, configuration et
durcissement et les parcours métier existants. Les tests s'exécutent exclusivement
sur `edubest_test` après activation explicite. Les bundles Android/iOS/web sont
exportés et TypeScript vérifié. Les vues de sécurité sont inspectées localement.
Le rapport de recette du dossier `verification/` précise les dernières exécutions.

Audit npm revérifié le 22 octobre 2026 : **0 vulnérabilité connue** sur les dépendances de
production API/web/shared. La chaîne d'outils mobile conserve **15 entrées hautes**
propagées par `braces` et `node-forge`. Aucun retour forcé à une ancienne version
incompatible d'Expo n'est appliqué. npm audit ne détecte pas les failles métier,
les vulnérabilités du système ou toutes les attaques possibles. L'inspection des
source maps des exports Android/iOS/web confirme que braces et node-forge ne sont
pas inclus dans ces bundles JavaScript ; cela ne clôt pas les alertes des outils
et ne constitue pas un audit de tous les composants natifs.

Le poste local utilise Node 22.14.0 pour les tests. Les images API/site ont été
installées proprement, compilées et exécutées avec Node 22.23.3 dans Docker :
mode production, base vide sans fixtures, refus des accès anonymes, identité de
déploiement et pages publiques vérifiés. La restauration PostgreSQL réelle a
été validée sur la base isolée de test après chiffrement AES-256-GCM. Un nouvel
APK de recette avec signature de développement a été construit ; aucun binaire
final signé avec l'identité de publication du client n'est fourni.

## Obligatoire avant de vrais dossiers

1. Domaine HTTPS, serveur et PostgreSQL maintenus, base dédiée, compte
   administrateur individuel et activation MFA avec sauvegarde des codes de secours.
2. Clé serveur aléatoire distincte par environnement, coffre et copie de secours.
   Ne pas remplacer cette clé sans migration : elle protège les MFA et les messages
   chiffrés en attente. Aucun secret dans les variables publiques web/mobile.
3. PostgreSQL privé ; pour une base distante, TLS avec vérification du certificat
   et du nom d'hôte. Vérifier le chemin de confiance du proxy et les IP réellement
   vues par les limiteurs ; ne pas exposer l'API d'origine en contournant le proxy.
4. Sauvegardes hors serveur chiffrées, accès limités, rétention et restauration
   réellement testées sur le futur hébergement. Le nouveau script chiffre le dump
   directement ; la copie hors serveur, sa rétention et les alertes restent à configurer.
5. Protection DDoS/WAF et surveillance configurées chez l'hébergeur : alertes sur
   erreurs et échecs d'authentification, disponibilité, capacité et expiration TLS.
   Rien n'est activé sur Cloudflare/Render par cette modification locale.
6. SMTP réel vérifié, SPF/DKIM/DMARC, antivirus ou analyse documentaire si des
   documents non fiables doivent être diffusés. Un PDF valide peut contenir du
   contenu dangereux malgré les contrôles de format.
7. Tests depuis le domaine réel et les téléphones, audit indépendant, traitement
   des alertes mobiles et suivi des correctifs. TOTP ne protège pas de tout
   phishing ; passkeys/WebAuthn ne sont pas encore implémentés.
8. Notice et organisation juridique de l'école, durées de conservation, contrats,
   traitement des demandes et procédure d'incident à finaliser. Aucune conformité
   légale n'est certifiée par les seuls contrôles techniques.

En cas d'incident : isoler le service concerné, conserver les traces, révoquer
les sessions compromises, remplacer les accès concernés avec une procédure
contrôlée et restaurer sur un environnement isolé. Ne jamais diffuser un dump ou
un journal contenant des dossiers d'élèves dans un ticket public.

## Références techniques

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Node.js 22.23.3](https://nodejs.org/en/blog/release/v22.23.3)

La présence de ces références n'est pas une affirmation de conformité complète
à chacun de ces référentiels.

## Correctifs de dépendances et préparation Octenium du 22 octobre

Next est passé de 16.4.0 à **16.4.2**, et ip-address à **10.7.4**, après les
nouvelles alertes publiées dans la base npm. L’audit des dépendances de production
API/web/shared retourne zéro vulnérabilité connue ; cela ne couvre pas les alertes
de l’outillage mobile mentionnées plus haut ni les vulnérabilités non connues.

Le chargeur cPanel exige un fichier privé hors public_html, permissions 600 sous
Linux, sans activation de test/démonstration. Deux clés distinctes sont générées
sans écrasement. Le préfixe de base doit correspondre au compte déclaré. La recette
HTTPS vérifie les refus anonymes et la notice ; aucune opération de maintenance
n’est exposée par une nouvelle route publique.

Avis : [Next SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Next cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr),
[Next Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r),
[ip-address](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).
