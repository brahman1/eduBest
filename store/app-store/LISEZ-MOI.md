# EduBest — dossier iOS et App Store

Préparation du 13 novembre 2026. Version 1.1.4, build iOS initial 1, identifiant `dz.edubest.app`. Le mode démonstration et son bouton sont désactivés dans le client iOS, y compris si d’anciennes URL ou une ancienne sélection sont conservées. La version normale utilise uniquement `https://api.edubest.dz/api` et `https://edubest.dz`.

## État réel du dossier

Le dossier reprend la version mobile 1.1.4 et le parcours de demande d’inscription, y compris les demandes sans cours et le choix d’un autre niveau scolaire. Les validations effectuées pour cette livraison sont récapitulées dans verification/ios-20261113. L’icône existante est fournie en PNG RGB 1024 × 1024 sans transparence.

L’export iOS vérifié contient les URL de l’école et aucune URL du serveur de démonstration. Les pages publiques d’accueil, de confidentialité et de suppression de compte, ainsi que la connexion du serveur fictif pour les captures, ont répondu HTTP 200 lors du contrôle du 13 novembre 2026. Cela ne remplace pas leur contrôle visuel sur iPhone.

**Aucun IPA signé ni aucune capture native iPhone/iPad n’a encore été généré dans cette intervention.** La conversation s’exécute sur Windows ; le Mac déclaré par le propriétaire n’est pas accessible dans les hôtes exposés aux outils. Les scripts de ce dossier doivent être exécutés et vérifiés sur le Mac. L’export JavaScript ne prouve pas le bon fonctionnement natif.

Le compte Expo de la station Windows est connecté, mais ce projet n’est pas encore lié à un Project ID EAS. Aucun nouveau projet distant, certificat, achat ni envoi à Apple n’a été créé automatiquement.

## 1. Transférer le projet sur le Mac

1. Télécharger et décompresser `EduBest-iOS-Preparation-20261113.zip`.
2. Placer le dossier décompressé dans `Documents`, par exemple `Documents/EduBest-iOS`.
3. Dans Codex sur le Mac, ouvrir ce dossier comme projet. Les sources mobile et serveur sont présentes pour conserver le monorepo npm ; aucun accès de production ni mot de passe n’est inclus.
4. Ouvrir le Terminal dans ce dossier. Si `rtk` est installé, les commandes de ce guide peuvent être lancées avec le préfixe `rtk proxy` ; le lanceur `Demarrer-iOS.command` évite la saisie des commandes principales.

## 2. Vérifier les outils Apple

Installer Xcode 26 ou plus récent, Node.js 22 ou plus récent, CocoaPods et la CLI EAS. Ouvrir Xcode au moins une fois ; accepter soi-même les accords proposés si vous les approuvez. Installer un runtime iOS dans Xcode > Settings > Components. Ajouter le compte Apple dans Xcode > Settings > Accounts.

Dans le Terminal, à la racine du dossier :

```sh
rtk proxy npm ci
rtk proxy npm run build -w shared
rtk proxy node ops/ios/mac.mjs doctor
```

La CLI EAS doit être installée sur le Mac et accessible sous le nom `eas`. Le script n’installe pas de logiciel système, ne paie pas de service et n’accepte pas d’accord à votre place.

## 3. Relier le vrai projet Expo et l’équipe Apple

Dans le Terminal de `mobile`, lancer `eas login` puis `eas init` avec votre compte et l’organisation souhaitée. Si EduBest existe déjà dans Expo, sélectionner ce projet ; ne pas en créer un doublon. La configuration TypeScript peut nécessiter d’inscrire le Project ID manuellement : le script suivant le place dans le fichier public `mobile/ios-build-settings.json`.

Depuis la racine :

```sh
rtk proxy node ops/ios/mac.mjs configure --expo-project VRAI_UUID_EXPO --apple-team VRAI_TEAM_ID
```

Remplacer les deux valeurs : Project ID UUID dans les réglages du projet Expo ; Team ID de 10 caractères dans Apple Developer > Membership details. Ces identifiants sont publics. Ne mettre dans ce fichier ni mot de passe, ni clé APNs, ni certificat. L’Apple ID et le nom du vendeur proviennent du compte choisi, pas du nom « EduBest ».

## 4. Tester la version normale sur simulateur

```sh
rtk proxy node ops/ios/mac.mjs simulator
```

Le script génère le projet natif avec Expo, installe les Pods, compile en Release sans signature et installe l’app sur un simulateur iPhone créé pour EduBest. Il ne réinitialise aucun simulateur existant.

La version normale se connecte à l’école réelle. Vérifier l’écran de connexion sans bouton de démonstration, puis effectuer les essais fonctionnels avec un accès autorisé. Ne pas utiliser les comptes fictifs du serveur de démonstration sur la production. Vérifier aussi clavier, sélecteur de document, partage PDF, impression, français/arabe et liens de confidentialité.

Pour l’iPad :

```sh
rtk proxy node ops/ios/mac.mjs simulator --ipad
```

## 5. Produire les vraies captures sans exposer les élèves

Une variante **réservée au simulateur**, identifiant `dz.edubest.captures`, utilise le serveur fictif isolé comme API principale. Elle n’ajoute aucun sélecteur de démonstration à l’interface. Elle sert à produire des images de la même interface avec des informations fictives. **Elle n’est pas le binaire App Store et ne doit jamais être archivée pour publication.** Le profil `ios-captures` est explicitement configuré pour le simulateur.

```sh
rtk proxy node ops/ios/mac.mjs simulator --captures
```

Se connecter avec les accès fictifs déjà remis dans le fichier privé de revue. Ils ne sont volontairement pas inclus dans ce ZIP. Sans ces accès, les demander au propriétaire ; ne jamais recopier le compte de direction réel.

Afficher chaque écran dans le simulateur, masquer le clavier et tout mot de passe, puis lancer à la racine :

```sh
rtk proxy node ops/ios/mac.mjs capture --name 01-espace-eleve
rtk proxy node ops/ios/mac.mjs capture --name 02-planning-eleve
rtk proxy node ops/ios/mac.mjs capture --name 03-espace-parent
rtk proxy node ops/ios/mac.mjs capture --name 04-suivi-enfants
rtk proxy node ops/ios/mac.mjs capture --name 05-espace-enseignant
rtk proxy node ops/ios/mac.mjs capture --name 06-annonces-ou-documents
```

Ne pas lancer les six commandes en bloc sans changer l’écran : chaque fichier doit montrer une vraie vue différente. Le script demande de confirmer `DONNEES FICTIVES` et ne remplace pas un fichier existant. Les fichiers se trouvent dans `store/app-store/screenshots/iphone/` avec une fiche de dimensions pour chaque PNG.

L’iPhone 16 Pro Max produit normalement des images portrait 1320 × 2868. L’iPhone 15 Pro Max produit 1290 × 2796. Les dimensions sont contrôlées sans redimensionnement. Inspecter visuellement chaque image ; une dimension correcte ne garantit pas une bonne mise en page. Prévoir des vues de l’app en usage, pas uniquement le logo ou la connexion.

Répéter avec `simulator --captures --ipad`, puis `capture --ipad --name ...` pour l’iPad Pro 13 pouces : 2064 × 2752 ou 2048 × 2732. Le support iPad étant activé, ses captures sont nécessaires. Pour une fiche arabe, refaire les captures après avoir activé la langue arabe ; ne pas réutiliser les captures françaises en les présentant comme arabes.

## 6. Créer l’application dans App Store Connect

1. App Store Connect > Mes apps > + > Nouvelle app.
2. Plateforme iOS, nom EduBest, langue principale français, Bundle ID `dz.edubest.app`, SKU proposé `EDUBEST-IOS-001`.
3. Si le Bundle ID n’existe pas encore, le créer pour la bonne équipe dans Apple Developer > Certificates, Identifiers & Profiles.
4. Choisir la catégorie Éducation et une disponibilité en Algérie. Choisir le téléchargement gratuit si c’est bien le modèle commercial validé.
5. Dans la version iOS 1.1.4, copier les textes fournis dans `metadata/fr-FR/`. Ajouter la localisation arabe seulement avec les textes et captures appropriés.
6. Utiliser les URL publiques du fichier `informations-communes.json`. Vérifier leur ouverture depuis un iPhone hors session administrateur.
7. Lire `CONFIDENTIALITE-ET-CLASSEMENT.md` et `ACCES-APP-REVIEW.md` avant de remplir les déclarations.

## 7. Générer l’IPA signé sur le Mac

```sh
rtk proxy node ops/ios/mac.mjs archive
```

Le script force le profil `ios-production` et les URL de l’école. Il ne réutilise pas le profil de captures. EAS local doit demander/valider les identifiants Apple et le provisioning de distribution avec l’équipe choisie. Ne pas partager les mots de passe ou codes 2FA dans le chat. Laisser l’outil gérer les credentials dans les emplacements privés appropriés.

L’IPA est créé sous `release/EduBest-iOS-<horodatage>.ipa`. Il n’existe qu’après le succès de la compilation native. Le numéro de build doit être unique ; EAS gère l’incrémentation distante après liaison au projet.

Si vous préférez une compilation cloud, `eas build --platform ios --profile ios-production` est possible après configuration. Vérifier les crédits et le plan Expo avant de lancer une opération payante. Le présent dossier utilise la compilation locale par défaut.

## 8. TestFlight et recette sur un vrai iPhone

Importer l’IPA dans App Store Connect avec Transporter, ou lancer `eas submit --platform ios --profile ios-production --path CHEMIN_DE_L_IPA` depuis `mobile`. Cette action importe un build ; elle ne remplace pas la soumission de la fiche à l’examen.

Attendre le traitement dans TestFlight. Installer le build sur un vrai iPhone et effectuer la recette de `RECETTE-IOS.md`. Configurer la clé APNs pour le bon projet Expo avant de promettre des notifications push ; tester l’app ouverte, en arrière-plan et fermée. Sans configuration/test APNs, seuls les messages internes chargés dans l’app sont vérifiés côté source.

## 9. Préparer l’accès des examinateurs

Le retrait du mode démonstration ne supprime pas l’exigence d’accès pour Apple. Les comptes fictifs existants appartiennent au serveur séparé ; ils ne fonctionnent pas avec le login de production sans adaptation technique. Ne pas les saisir dans App Store Connect en affirmant qu’ils fonctionnent déjà avec cet IPA.

**Ce point reste à résoudre avant soumission** : fournir des comptes de revue accessibles depuis la connexion normale de ce même build et isolés des dossiers réels, ou convenir d’un autre mécanisme approuvé par Apple. Cela nécessite une décision et une préparation serveur ; aucun routage caché ni contournement de 2FA n’a été ajouté.

## 10. Soumettre, une fois tous les éléments réels prêts

Sélectionner le build testé, ajouter les captures natives vérifiées, remplir les coordonnées du contact de revue et les déclarations. Dans `ACCES-APP-REVIEW.md`, remplacer les champs à compléter uniquement par des accès fonctionnels vérifiés. Choisir de préférence une publication manuelle pour contrôler la date de sortie. Envoyer ensuite pour examen.

Ne pas considérer ce dossier de préparation comme une preuve de signature, de captures produites, de notifications configurées ou d’approbation Apple.

## Sources officielles vérifiées

- Exigences SDK/Xcode : https://developer.apple.com/news/upcoming-requirements/
- Captures : https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Examen et accès : https://developer.apple.com/app-store/review/guidelines/
- Confidentialité : https://developer.apple.com/app-store/app-privacy-details/
- Compilation locale EAS : https://docs.expo.dev/build-reference/local-builds/

## Point de contrôle des emails avant livraison

Le rejet Microsoft S3150 a été identifié sur le réseau SMTP Octenium. Le relais HTTPS alternatif est préparé dans les sources serveur mais son activation et sa validation en production restent à réaliser. Vérifier la réception Outlook et Gmail, la confirmation de demande puis sa validation par l’école avant la recette finale TestFlight.

## Série guidée de captures App Store

Sur le Mac, ouvrir le projet dans Codex. Lui demander de prendre en charge les actions ci-dessous, de naviguer dans le simulateur et de vérifier les PNG. Les comptes fictifs sont à saisir depuis le fichier privé du propriétaire, hors de toute capture.

Depuis la racine du projet, après installation des dépendances et des outils Apple, lancer pour l’iPhone :

```sh
rtk proxy node ops/ios/capture-series.mjs
```

Puis pour l’iPad :

```sh
rtk proxy node ops/ios/capture-series.mjs --ipad
```

La série comprend connexion, inscription si disponible sur le serveur fictif, espace élève, planning élève, espace parent, planning enseignant et documents. Le script ouvre le simulateur, demande d’afficher chaque écran, puis utilise la capture native existante qui contrôle les dimensions. Il ne navigue pas automatiquement entre les comptes et écrans. L’agent sur le Mac doit le faire et vérifier chaque image avant remise.

Chaque famille produit son ZIP sous release. Les dossiers store/app-store/screenshots/iphone et ipad contiennent les PNG d’origine et les résultats de validation. Les captures doivent correspondre à la langue de la fiche App Store et présenter des données fictives.

Cette préparation Windows ne contient pas encore de PNG iPhone ou iPad. Les fichiers A-LIRE.txt ne constituent pas des captures et ne sont pas à importer dans App Store Connect.
