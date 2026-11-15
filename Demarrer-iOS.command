#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Installer Node.js 22 ou plus récent sur le Mac, puis relancer."
  read -r -p "Appuyez sur Entrée pour fermer. "
  exit 1
fi
echo "EduBest — préparation iOS"
echo "1. Installer les dépendances npm (première utilisation)"
echo "2. Vérifier le Mac et Xcode"
echo "3. Compiler/ouvrir le simulateur iPhone avec données fictives pour captures"
echo "4. Compiler/ouvrir le simulateur iPad avec données fictives pour captures"
echo "5. Enregistrer une capture iPhone affichée"
echo "6. Enregistrer une capture iPad affichée"
echo "7. Compiler/ouvrir la version normale sur simulateur iPhone"
echo "8. Générer l’IPA de production signé (après configuration Expo/Apple)"
echo "9. Ouvrir le guide"
read -r -p "Choix : " choice
case "$choice" in
  1) npm ci && npm run build -w shared ;;
  2) node ops/ios/mac.mjs doctor ;;
  3) node ops/ios/mac.mjs simulator --captures ;;
  4) node ops/ios/mac.mjs simulator --captures --ipad ;;
  5) read -r -p "Nom simple, par exemple 02-planning : " shot; node ops/ios/mac.mjs capture --name "$shot" ;;
  6) read -r -p "Nom simple, par exemple 02-planning : " shot; node ops/ios/mac.mjs capture --ipad --name "$shot" ;;
  7) node ops/ios/mac.mjs simulator ;;
  8) node ops/ios/mac.mjs archive ;;
  9) open store/app-store/LISEZ-MOI.md ;;
  *) echo "Aucune action lancée." ;;
esac
read -r -p "Appuyez sur Entrée pour fermer. "
