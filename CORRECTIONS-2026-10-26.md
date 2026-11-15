# EduBest — corrections locales du 26 octobre 2026

**État : code corrigé et testé localement. Rien publié, aucun navigateur utilisé, aucun accès à la base de production, aucun email réel envoyé.**

## Ordre de réalisation et résultat

| Ordre | Problème | Correction |
| --- | --- | --- |
| 1 | Dashboard et droits élève/parent | Tableau de bord familial dédié sur web et mobile : cours, planning, échéances personnelles et présences. Suppression des encaissements et présentations de gestion d’école dans cet espace. Navigation contrôlée par rôle ; contrôles serveur et périmètres individuels conservés. |
| 2 | Double authentification | Réservée à OWNER et MANAGER, les deux rôles administrateurs. Retirée pour CASHIER, TEACHER, PARENT et STUDENT, y compris les anciens enrôlements. Mot de passe, autorisations et confirmation sensible restent actifs. |
| 3 | Comptes et dossiers élèves différents | Inviter un STUDENT crée automatiquement son dossier, ou rattache un dossier existant sans compte. Une seule identité et un dossier par accès. Modifier le nom d’un dossier déjà lié actualise le compte. Une association nouvelle utilise le nom du compte. Les doublons sont refusés, y compris au niveau SQL. |
| 4 | Anciens dossiers | La migration aligne les anciens noms sur le compte élève associé. Elle ne choisit pas arbitrairement entre plusieurs dossiers liés à un même accès. Si plusieurs dossiers actifs partagent un compte élève, ses données scolaires sont bloquées et une alerte administrateur demande de corriger les liens. Aucun élève n’est supprimé. |
| 5 | Mon profil | Section dédiée web, profil mobile : nom complet, email, rôle et établissement ; langue et état de vérification sur le web. L’identité et le rôle ne sont pas modifiables par l’élève ou le parent. |
| 6 | Montant DA ou pourcentage ambigu | Le libellé du formulaire suit le choix : DA / séance, DA / heure ou part enseignant en %. Exemple explicite pour le pourcentage ; validation serveur de 0 à 100 %. Conversion centimes / points de base conservée. |
| 7 | Rémunération des enseignants | Calcul commun utilisé par le détail et le dashboard enseignant, décomposition du tarif et du montant gagné. Action « Enregistrer l’appel et terminer la séance » après la fin du cours : la séance entre alors dans le calcul. Règlements et remboursements vérifiés ; choix du mois également sur mobile. |
| 8 | Invitations Microsoft | Expéditeur d’enveloppe cohérent avec l’adresse d’envoi par défaut, Message-ID de domaine, TLS et remontée des erreurs SMTP. Interface admin « Suivi des envois », tentatives, refus permanents/transitoires et bouton de renvoi d’invitation avec nouveau lien. Un ancien lien remplacé n’est plus distribué. |
| 9 | Échéances à imprimer / enregistrer / envoyer | Impression et sauvegarde PDF via le web ; génération PDF et partage/enregistrement sur Android/iOS via le module Expo officiel. À la création d’une échéance, email au parent actif avec adresse vérifiée, sinon à l’élève vérifié ; notification interne aux deux comptes actifs associés et push si appareil enregistré. Bouton de renvoi explicite. La génération mensuelle ne réémet pas les échéances déjà créées. |
| 10 | Annonces | Une annonce de groupe prépare les emails et notifications des élèves et parents concernés et de l’enseignant associé. Les élèves archivés et comptes désactivés ne sont pas destinataires. Une annonce générale concerne les comptes actifs de l’école. |
| 11 | Notifications | Boîte interne, compteur de non-lus et actualisation périodique sur web/mobile ; réception et ouverture des notifications mobiles vers la bonne section autorisée. File push avec tickets et contrôle des reçus Expo. Contenu de l’écran verrouillé volontairement générique. |
| 12 | Exports administrateur | Exports Excel **.xlsx réel**, plusieurs feuilles, et JSON : élèves, parents, enseignants, échéances, mouvements, bilan, rémunérations versées, rémunérations calculées par mois et présences. Période en heure d’Alger. Autorisations admin, confirmation d’identité récente et journal d’export. Données de connexion et mots de passe exclus. |
| 13 | Statistiques | Présences / absences par élève et présences des élèves regroupées par enseignant, visibles sur les dashboards web/mobile. Uniquement les séances terminées ; présents + retards au numérateur, appels renseignés au dénominateur ; non renseignés exclus, absence de données affichée par un tiret. Ces taux ne prétendent pas mesurer la présence physique du professeur. |

## Points importants pour utiliser les corrections

- **Ne pas recréer l’élève après son invitation** : compléter son dossier existant dans Élèves & familles, associer son parent puis l’inscrire au groupe.
- Une séance prévue n’ouvre pas encore de rémunération par séance ou heure. Il faut la terminer après son horaire de fin. Les pourcentages reposent sur les encaissements nets ; les tarifs historiques sont préservés.
- Une confirmation d’identité de dix minutes reste nécessaire pour les actions sensibles. Le mobile dispose maintenant de sa propre confirmation dans Mon profil ; une confirmation effectuée dans une autre session web ne suffit pas pour la session mobile.
- Les documents d’échéance et reçus sont des documents de suivi scolaire, sans valeur de facture fiscale.
- Les annuaires d’export sont complets ; la période filtre les échéances par date limite, les mouvements par date d’enregistrement, les présences par date du cours. La feuille de rémunération mensuelle couvre les mois entiers touchés par la période et l’indique explicitement.

## Vérifications réalisées

- Vérification TypeScript des quatre espaces : shared, API, web et mobile.
- Compilation Linux de l’API et du site : Node 22.23.4, Next 16.4.2.
- **105 tests réussis, zéro échec**, PostgreSQL 16.15, HTTPS et serveur mail fictif sur réseau Docker interne. Ancienne politique MFA, liens ambigus, refus d’accès, facture, remboursements et exports couverts. Aucun trafic de ces tests vers la production.
- Rendu serveur du dashboard et du profil pour OWNER, TEACHER, PARENT et STUDENT en français/arabe ; pas de navigateur ni de recette visuelle interactive.
- Bundles Expo Android, iOS et web exportés localement avec le module PDF. Ce sont des vérifications de bundles JavaScript, pas des APK/AAB/IPA signés ni un test sur téléphone.
- Rapport automatisé : `verification/review-local-2026-10-26.json`.
- Classeur relu avec openpyxl 3.1.5 : ZIP valide, arabe conservé, montants numériques et noms ressemblant à des formules conservés comme texte (`verification/review-xlsx-2026-10-26.json`).

## Ce qui ne peut pas être confirmé par un correctif local seul

**Microsoft / Outlook / Hotmail / Microsoft 365.** Une acceptation SMTP ne prouve pas la réception. Un refus lié à SPF, DKIM, DMARC, au reverse DNS, à la réputation de l’IP Octenium ou à un filtrage du destinataire se traite avec l’hébergeur ou l’administrateur mail. Le code classe désormais les refus et permet de consulter leur état. Aucune configuration DNS ni boîte mail de production n’a été modifiée et aucun test réel Microsoft n’a été envoyé.

**Push sur appareils.** Le code est prêt à enregistrer les appareils et traiter les tickets/reçus Expo. Les identifiants Expo/FCM/APNs et une installation native recompilée restent nécessaires pour prouver la remise Android/iOS. Le nouveau module `expo-print` impose de reconstruire l’application native ; l’ancien APK ne contient pas ce module.

**Documents natifs et ergonomie.** La compilation et le rendu serveur sont validés. L’impression et le partage PDF sur un vrai téléphone, la permission de notifications et les parcours tactiles seront à vérifier lors de la recette appareil, sans prétendre les avoir testés ici.

## Livraison future — aucune exécution aujourd’hui

1. Sauvegarder la base et vérifier la restauration avant la mise à jour.
2. Livrer ensemble API et web ; appliquer **008-delivery-and-role-policy.sql** par le système normal de migrations. Ce fichier est uniquement préparé et testé sur la recette isolée, pas appliqué sur Octenium.
3. La migration retire les facteurs des rôles non administrateurs, aligne les noms des dossiers liés sur leur compte et ajoute les métadonnées de livraison. Les facteurs administrateurs sont conservés. Les dossiers historiques ambigus nécessitent une correction des liens par la direction.
4. Ne jamais importer `schema-empty.sql` sur la base existante : il sert uniquement aux nouvelles installations vides.
5. Reconstruire les applications natives et vérifier les emails Microsoft et push réels après configuration des services.
6. Les anciens ZIP de livraison antérieurs à cette correction restent des archives historiques. Utiliser les sources de cette version locale pour une future compilation ; aucune bascule Octenium n’a été effectuée.
