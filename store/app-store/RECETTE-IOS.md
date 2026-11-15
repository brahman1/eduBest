# Recette à réaliser sur le Mac puis avec TestFlight

État initial de cette liste : **toutes les validations natives restent à faire**. Le contrôle TypeScript, les 25 tests de logique et l’export JavaScript ne cochent pas ces cases.

- [ ] Génération du projet iOS et installation CocoaPods réussies.
- [ ] Compilation Release sur simulateur iPhone et iPad réussie.
- [ ] IPA signé avec l’équipe Apple du client ; bundle ID `dz.edubest.app` ; version 1.1.3 et numéro de build unique.
- [ ] Installation TestFlight sur un vrai iPhone.
- [ ] Écran de connexion sans accès ni bandeau de démonstration.
- [ ] Connexion et déconnexion ; mauvais mot de passe ; réseau indisponible ; reprise après expiration de session.
- [ ] Administrateur : 2FA et confirmation d’identité ; restrictions des autres rôles préservées.
- [ ] Élève : planning personnel, cours, documents et présences correspondant uniquement à son dossier.
- [ ] Parent : sélection des enfants autorisés et suivi des bonnes informations.
- [ ] Enseignant : groupes et planning autorisés ; appel et présence sur une donnée de recette adaptée.
- [ ] Direction : fonctions de gestion, suppression de cours/professeurs selon les garde-fous existants.
- [ ] Français et arabe ; lecture droite-à-gauche ; clavier, défilement et grands caractères.
- [ ] Documents : import via le sélecteur système, téléchargement, partage et impression PDF.
- [ ] Liens de confidentialité, aide et suppression accessibles ; suppression du compte personnel testée sur un compte dédié jetable.
- [ ] Notifications internes vérifiées.
- [ ] Project ID Expo et APNs configurés ; push réel autorisé et reçu en premier plan, arrière-plan et app fermée, si cette fonction est retenue.
- [ ] Aucune clé serveur, mot de passe, certificat privé ou donnée d’élève réel dans le dossier public et les captures.
- [ ] Captures natives iPhone et iPad produites, dimensions vérifiées et contrôle visuel effectué ; localisation arabe si publiée.
- [ ] Compte App Review fonctionnel dans le binaire de production et isolé des dossiers réels.
- [ ] Questionnaire de confidentialité et d’âge validé par le responsable de l’école.
- [ ] Fiche et capture choisies correspondent au comportement du build TestFlight retenu.
