# EduBest mobile 1.1.0 — livraison d’essai Android

## Fichier à installer

`release/EduBest-Essai-1.1.0-20261027.apk`

- Application : **EduBest Essai**.
- Identifiant : `dz.edubest.preview`, distinct de la future application publique `dz.edubest.app`.
- Android 7.0 minimum, processeurs ARM 32/64 bits. Cet APK ne vise pas les émulateurs x86.
- Compilation native en mode release, JavaScript/Hermes embarqué : aucun serveur Metro nécessaire.
- Signature de développement réservée aux essais. **Ne pas téléverser ce fichier sur Google Play.**
- Aucun compte, mot de passe ni dossier fictif préchargé. Connexion aux services EduBest existants.

## Installer sur ton téléphone Android

1. Télécharge l’APK sur ton ordinateur puis transfère-le sur ton téléphone, par exemple par câble USB dans **Téléchargements**.
2. Sur le téléphone, ouvre **Fichiers** ou **Mes fichiers**, puis **Téléchargements**.
3. Touche `EduBest-Essai-1.1.0-20261027.apk`.
4. Si Android le demande, autorise temporairement l’installation depuis cette application de fichiers. Reviens à l’installation et touche **Installer**. Tu peux retirer cette autorisation après installation.
5. Ouvre **EduBest Essai**. Connecte-toi avec ton propre compte EduBest, avec le même mot de passe que sur le site. Aucun compte de test n’a été créé.
6. Pour un administrateur déjà protégé, saisis le code de son application d’authentification. Pour un administrateur sans protection activée, l’application ouvre **Mon profil** afin de terminer l’activation.

L’application communique avec le vrai service en ligne : les modifications effectuées après connexion sont de vraies modifications. Pour la recette métier, utiliser des comptes et données de recette dans une installation séparée si l’on veut éviter toute écriture réelle. Ce travail n’a exécuté aucune écriture sur Octenium.

## Ajouts mobiles de cette version

- Accueils élève, parent et enseignant personnalisés préparés dans la version précédente.
- Planning natif semaine/mois, navigation de dates, sélection d’un jour, cours colorés par groupe, filtres par groupe et enfant lorsque les associations sont fournies par le serveur.
- Salle, enseignant, horaires d’Alger, statut et enfants concernés ; ouverture de la fiche, modification d’une séance autorisée et appel depuis un cours commencé.
- Cours récurrents : jours, heure, durée, fréquence, mois exclus, dates exclues, pauses, conflits, prévisualisation et création avec identifiant anti-doublon.
- Fermetures : consultation ; pour l’administrateur, prévisualisation des cours concernés puis confirmation de leur annulation. Retirer une fermeture ne rétablit pas les séances déjà annulées.
- Consultation et annulation des séances futures des séries autorisées.
- Sécurité native : confirmation d’identité, activation 2FA administrateur, codes de secours, sessions connectées et révocation d’un autre appareil. La clé de configuration et les codes de secours restent en mémoire de l’écran, sans stockage persistant ni envoi automatique.
- Rotation du jeton après activation MFA ; conservation de la session en cas de mot de passe/code de confirmation erroné ; nettoyage des données affichées à expiration de la session ou déconnexion.
- Messages réseau plus clairs et protection contre la déconnexion provoquée par une ancienne requête après renouvellement du jeton.
- Profil, échéances PDF, partage de documents, exports et autres fonctions existantes conservés.

## Adresses et sécurité de transport

- API : `https://api.edubest.dz/api`.
- Site et mentions : `https://edubest.dz`.
- Les deux routes publiques de santé, sur le domaine API et sur le proxy du site, ont répondu HTTP 200 avec du JSON le 27 octobre 2026. Ce contrôle ne constitue pas un test de connexion avec un compte réel.
- Le manifeste Android de l’essai interdit le trafic HTTP en clair et désactive la sauvegarde automatique Android. La session native utilise Expo SecureStore.
- Aucun identifiant PostgreSQL, mot de passe SMTP, clé de chiffrement serveur ou accès cPanel n’est intégré au client.

## Ce qui reste avant publication

### API et site

Les nouveaux tableaux de bord dépendent de l’évolution API préparée localement le 27 octobre. **Elle n’a pas été déployée pendant ce travail.** Tant que le serveur ne fournit pas ces données, l’application d’essai affiche une explication et donne accès au planning, aux documents et aux notifications, plutôt que d’afficher à tort un emploi du temps vide.

Il faut mettre à jour ensemble le site et l’API avec les sources récentes. Le ZIP du 26 octobre ne contient pas les derniers tableaux de bord. Cette note ne remplace pas une nouvelle préparation du paquet de déploiement.

### Notifications

La boîte de notifications interne utilise le serveur existant. Cet APK d’essai ne contient pas de projet Expo/FCM configuré : **aucune réception de push à distance n’est annoncée comme opérationnelle**.

Pour les push Android : projet Expo réel, application Firebase correspondant à `dz.edubest.app`, fichier Android de configuration et identifiants FCM serveur. Pour iOS : identifiants Apple/APNs et configuration Expo correspondante. Ne pas placer les clés privées dans `EXPO_PUBLIC_*`.

Les SMS par numéro de téléphone ne sont pas intégrés dans cette livraison : ils nécessitent encore le choix du prestataire et son raccordement.

### Android public

Créer/configurer le compte Google Play et la signature de publication, conserver les clés hors du dépôt, définir un code de version croissant puis générer un AAB signé de production pour `dz.edubest.app`. Le script existant `ops/build-android-release.ps1` conserve son contrôle des identifiants de publication.

### iOS

Les sources et le bundle iOS sont préparés. Aucun IPA signé n’est livré : il faut les accès Apple/Expo et une compilation iOS avec les outils/signatures appropriés, puis une recette sur iPhone.

## Vérifications effectuées et limites

- TypeScript : shared, API, web, mobile réussis.
- 19 tests de logique : calendrier, récurrences, filtres personnels et gestion de session mobile.
- Vérifications de configuration : publication refusée sans identifiants requis, URLs locales et exemples refusés ; profil d’essai distinct en HTTPS, sans identifiant Expo inventé.
- APK natif compilé, signature vérifiée, identité/version/architectures vérifiées et adresse publique de l’API retrouvée dans le bundle embarqué.
- Bundles Android, iOS et web exportés ; présence des modules planning, récurrences, sécurité et PDF vérifiée par les cartes de sources.
- Aucun appareil physique connecté ; les parcours tactiles, le clavier, les applications d’authentification, l’impression/partage et les push réels restent à tester sur téléphone.
- Aucun navigateur utilisé, aucun achat ni publication sur un store, aucune modification du site en ligne ou de la base de production.

## Reconstruire l’essai

Depuis la racine du projet sur ce poste Windows avec Java et le SDK Android :

```powershell
rtk proxy powershell -NoProfile -ExecutionPolicy Bypass -File ops/build-android-preview.ps1
```

Pour reprendre la compilation du même projet natif d’essai après une modification JavaScript, sans regénérer Android : ajouter `-Resume`. Après une modification de configuration native ou de dépendance native, utiliser la commande complète sans `-Resume`.

Contrôles de logique reproductibles : `rtk proxy npm.cmd run test:mobile`.
