# Déclarations Apple — fiche de préparation

Cette fiche décrit les fonctions du code préparé. Les réponses doivent être vérifiées avec les traitements réellement activés par l’école et ses prestataires avant enregistrement dans App Store Connect. Ne pas choisir globalement « aucune donnée collectée ».

## Données et finalités

| Catégorie Apple à examiner | Données du service | Déclaration à préparer |
|---|---|---|
| Coordonnées : nom, email, téléphone | Comptes et dossiers fournis par l’école | Fonctionnement de l’app ; données liées à l’utilisateur |
| Identifiant utilisateur | ID du compte, rattachements de rôles et de familles | Fonctionnement de l’app ; lié à l’utilisateur |
| Autres données | Niveau, date de naissance, cours et présences | Fonctionnement de l’app ; lié au dossier scolaire |
| Informations financières / historique d’achats, selon les données conservées | Échéances, montants, méthodes de règlement, reçus, rémunération des enseignants | Examiner « Payment Info », « Other Financial Info » et « Purchase History » selon les champs ; fonctionnement ; liés à l’utilisateur |
| Contenu utilisateur : messages, autres contenus, photos/vidéos si envoyées | Annonces, documents et pièces jointes sélectionnés par l’utilisateur | Fonctionnement ; liens au compte selon le contenu ; ne pas confondre sélection d’un fichier avec lecture de toute la photothèque |
| Données d’utilisation / autres diagnostics, selon le déploiement | Journal d’accès, événements de sécurité et actions administratives ; outils de crash éventuels | Déclarer les données réellement transmises et leur finalité ; aucun outil publicitaire ou SDK d’analytique marketing n’est configuré dans la préparation |
| Identifiants d’appareil | Jeton push lorsqu’Expo/APNs est activé et l’utilisateur autorise les notifications | Fonctionnement ; rattachement au compte ; valider après configuration |

**Suivi publicitaire : non prévu dans cette préparation.** Aucun SDK publicitaire ni permission de suivi ATT n’est ajouté. L’absence de suivi publicitaire ne signifie pas absence de données collectées pour la scolarité.

Les justificatifs et les champs libres peuvent contenir des informations sensibles. Si l’école demande ou conserve des certificats médicaux ou d’autres données de santé, examiner aussi la catégorie santé ; ne pas déclarer automatiquement qu’aucune donnée sensible n’existe. Ne pas conserver des pièces inutiles.

URL confidentialité : https://edubest.dz/legal. Responsable école : KACI Belkacem. Contact école : contact@edubest.dz. Contact technique complémentaire Brainfor : contact@brainfor.net. Le nom légal du vendeur Apple sera celui du compte Apple choisi et reste à vérifier.

## Âge et catégorie

Catégorie proposée : Éducation. Le service est utilisé par des élèves, dont des moins de 13 ans, ainsi que par leurs parents et enseignants. Répondre honnêtement au questionnaire Apple. Ne pas transposer automatiquement la classification PEGI/IARC de Google ni promettre une classification 4+ avant le calcul Apple.

La catégorie « Enfants » n’est pas sélectionnée automatiquement : elle impose des obligations particulières. Valider le positionnement de la fiche avec le propriétaire. Déclarer les documents, annonces et échanges accessibles réellement ; ne pas répondre qu’aucun contenu utilisateur n’existe alors que l’école peut partager des contenus.

## Chiffrement, paiement, accès et notifications

- Le client utilise HTTPS et les services de stockage sécurisé d’Apple. `ITSAppUsesNonExemptEncryption=false` est préparé pour l’usage des mécanismes standard du système ; revalider si une bibliothèque de chiffrement ou un mécanisme métier supplémentaire est ajouté.
- L’application ne propose pas de paiement par carte intégré ni d’achat intégré. Elle affiche des règlements de prestations scolaires enregistrés par l’école. Ne pas présenter ce suivi comme une intégration bancaire.
- Les élèves et les parents peuvent demander leur inscription depuis l’app. L’adresse email doit être confirmée et la demande approuvée par l’école avant activation. La suppression du compte personnel est accessible dans le parcours Compte, sous conditions d’autorisation ; les écritures financières ne sont pas toutes effacées avec le login. Vérifier ce parcours sur l’iPhone réel et la notice.
- Les notifications distantes requièrent un vrai Project ID Expo, la capacité Push Notifications et une clé APNs du bon compte Apple. Elles ne sont pas encore configurées/testées dans ce livrable. Ne pas déclarer un service APNs opérationnel avant l’essai TestFlight.
- Ne pas cocher des garanties d’accessibilité sans essais VoiceOver, agrandissement du texte et contraste sur les appareils pris en charge.

Sources : https://developer.apple.com/app-store/app-privacy-details/ ; https://developer.apple.com/app-store/review/guidelines/
