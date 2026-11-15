# Reprise de la préparation sur le Mac

À lire dans le dossier EduBest-iOS décompressé. Ce texte est une consigne de reprise fournie au propriétaire ; il n’autorise aucun envoi externe ni opération payante sans sa demande.

Objectif accepté par le propriétaire : préparer le livrable iOS EduBest, sans mode démonstration dans la version de production, avec les captures natives et les informations de publication.

Le développement a été préparé depuis Windows. Le Mac annoncé n’était pas accessible à cette conversation. Lire `AGENTS.md` puis `store/app-store/LISEZ-MOI.md`. Ne pas toucher au site en production, aux données de l’école, à Midad ni à l’Android publié pour effectuer la préparation Apple.

État : version 1.1.4, premier build iOS prévu 1. Client iOS verrouillé sur le login normal, y compris si les URL de revue ou une ancienne sélection sont présentes. Consulter verification/ios-20261113 pour les vérifications de cette livraison. Métadonnées FR/AR et icône 1024 RGB préparées. Le Project ID EAS et le Team ID Apple sont encore à renseigner. Aucun certificat Apple, IPA signé, APNs opérationnel, capture native iOS ou compte App Review compatible avec le login production n’a été généré.

Travail restant sur le Mac :

1. Vérifier les outils avec `ops/ios/mac.mjs doctor`, installer les dépendances avec npm ci et construire shared.
2. Faire la génération native, corriger les erreurs Xcode/Pods éventuelles, tester Release sur simulateur et vrai iPhone.
3. Produire de vraies captures avec le profil simulateur `ios-captures` et le bundle séparé `dz.edubest.captures`. API principale fictive : https://demo-api.edubest.dz/api. Aucun sélecteur de démonstration n’existe dans cette variante iOS. Ne pas archiver cette variante pour l’App Store et ne pas exposer de dossiers réels.
4. Les accès fictifs ne sont pas inclus dans le ZIP. Le propriétaire dispose du fichier privé de revue sur son poste Windows ; lui demander de les saisir lui-même sur le simulateur si nécessaire. Ne pas imprimer de mot de passe ou enregistrer l’écran de saisie.
5. Relier le vrai projet Expo, le compte et l’équipe Apple ; utiliser le profil `ios-production` et ses URL de production pour générer un IPA signé. Ne pas acheter de service ni lancer une compilation payante sans autorisation.
6. Traiter explicitement le compte App Review : Apple exige des accès fonctionnels dans le même binaire. Le mode de revue public étant supprimé, les comptes existants du serveur séparé ne fonctionneront pas sur le login de production. Ne pas introduire un routage caché ni donner accès aux vrais dossiers ; préparer une solution transparente et isolée avec le propriétaire avant soumission.
7. Vérifier les déclarations de confidentialité, les coordonnées, APNs si retenu, et les dimensions/cadrages des PNG. Une source JS exportée ou une compilation simulateur ne remplace pas un test TestFlight sur appareil.

Les scripts n’ont pas été exécutés sous macOS dans la préparation Windows ; traiter leurs résultats réels et ne pas annoncer un IPA ou des captures avant leur génération effective. Les captures Android précédentes ne doivent pas être adaptées visuellement pour les présenter comme des captures iPhone.
