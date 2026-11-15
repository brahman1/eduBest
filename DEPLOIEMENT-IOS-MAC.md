# EduBest sur le Mac

Version mobile préparée 1.1.4. Identifiant iOS `dz.edubest.app`.

## Récupérer le projet

Ouvrir Terminal et lancer les commandes suivantes. Si un dossier eduBest existe déjà, ouvrir ce dossier et vérifier ses modifications avant de lancer git pull.

```sh
cd ~/Documents
git clone https://github.com/brahman1/eduBest.git
cd eduBest
npm ci
npm run build -w shared
```

Installer Xcode 26 ou plus récent, un simulateur iOS, Node.js 22.13 ou plus récent et CocoaPods. Ouvrir Xcode pour terminer son installation et ajouter le compte Apple Developer dans ses réglages.

```sh
node ops/ios/mac.mjs doctor
```

## Ouvrir le projet dans Codex

Ouvrir le dossier Documents/eduBest comme projet dans Codex sur le Mac. Donner cette consigne à l’agent.

> Lis AGENTS.md et DEPLOIEMENT-IOS-MAC.md. Prépare et teste la version iOS 1.1.4, réalise les captures natives iPhone et iPad avec des données fictives, puis prépare l’IPA signé. Consulte store/app-store/ACCES-APP-REVIEW.md. Signale les résultats réels et les étapes nécessitant mes comptes. Termine par TestFlight avant la soumission App Store.

## Lier Expo et Apple

Installer EAS CLI si nécessaire et se connecter au compte Expo.

```sh
npm install --global eas-cli
cd mobile
eas login
eas init
cd ..
```

Sélectionner le projet Expo EduBest existant si disponible. Relever son Project ID dans Expo et le Team ID de dix caractères dans Apple Developer. Configurer leurs valeurs réelles dans la commande suivante.

```sh
node ops/ios/mac.mjs configure --expo-project UUID_EXPO --apple-team TEAM_ID_APPLE
```

Le fichier mobile/ios-build-settings.json contient uniquement ces identifiants publics. Conserver les clés et certificats dans les outils de signature.

## Tester et capturer

```sh
node ops/ios/mac.mjs simulator
node ops/ios/capture-series.mjs
node ops/ios/capture-series.mjs --ipad
```

Les deux dernières commandes lancent le parcours guidé. Afficher chaque écran dans le simulateur puis confirmer sa capture. Les PNG et leur contrôle de dimensions sont conservés dans store/app-store/screenshots. Les comptes du serveur fictif sont à saisir depuis le fichier privé du propriétaire.

## Compiler et envoyer dans TestFlight

```sh
node ops/ios/mac.mjs archive
```

EAS demande les éléments de signature Apple. L’IPA produit se trouve dans release. Créer la fiche EduBest dans App Store Connect avec le Bundle ID dz.edubest.app et la version 1.1.4. Depuis mobile, importer l’IPA avec son chemin réel.

```sh
cd mobile
eas submit --platform ios --profile ios-production --path /chemin/vers/EduBest.ipa
```

Après traitement Apple, installer l’application via TestFlight et suivre store/app-store/RECETTE-IOS.md. Ajouter les métadonnées FR/AR, les captures vérifiées, la confidentialité et le contact de revue dans App Store Connect. Sélectionner le build testé puis envoyer pour examen.

## Points à finaliser

- Aucun IPA ni capture native iOS n’a été produit depuis le poste Windows.
- Les accès App Review doivent fonctionner dans le même binaire et isoler les données réelles.
- Tester les notifications après configuration APNs et du projet Expo.
- Le relais email HTTPS est présent dans les sources serveur. Son activation sur Octenium et la réception Outlook restent à confirmer avant la recette des inscriptions.
- La compilation locale requiert les outils Apple. Les conditions de l’abonnement Expo s’appliquent aux compilations cloud éventuelles.

Guide détaillé dans store/app-store/LISEZ-MOI.md.
