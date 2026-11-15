# EduBest - Identité du site et des applications

La signature approuvée est **EduBest.** et le monogramme mobile **EB.**
Le livre bleu/vert appartient à l'ancienne identité et n'est plus utilisé par les interfaces.

## Palette

| Rôle | Couleur |
| --- | --- |
| Bleu profond, identité et navigation | `#193A4E` |
| Bleu clair, point et détails décoratifs | `#6D9EBB` |
| Bleu pâle, logo clair et textes sur fond sombre | `#ADC6D8` |
| Blanc cassé, fond principal | `#F5F7FA` |
| Bleu d'action, boutons et liens sur fond clair | `#315D76` |
| Texte secondaire sur fond clair | `#536B7A` |
| Surface et cartes | `#FFFFFF` |
| Bordures | `#D6E2E9` |

Le bleu clair du point sert d'accent. Les textes et boutons sur fond clair utilisent
le bleu d'action plus foncé pour conserver leur lisibilité. Les états positif,
d'alerte et d'erreur restent respectivement verts, ambre et rouges. Les couleurs
des cours servent à distinguer les groupes dans le calendrier.

## Logos

- `web/public/brand/edubest-logo.png` et `mobile/assets/edubest-logo.png` :
  variante foncée pour les surfaces claires.
- Les variantes `-light.png` conservent les couleurs du logo approuvé et s'utilisent
  sur les menus, fonds et icônes bleu profond.
- Le monogramme EB. sert aux icônes, au démarrage et aux emplacements compacts.
- Ne pas étirer les logos, ajouter un pictogramme livre ou changer leurs proportions.
- Les icônes iOS sont carrées et opaques ; le système applique les coins arrondis.
- Android utilise des calques adaptatifs, un masque monochrome et les densités dédiées.

## Typographie et interfaces

Le web utilise DM Sans pour le texte, Manrope pour les titres et Noto Sans Arabic
pour l'arabe. Le mobile conserve la typographie native pour une lecture adaptée
à chaque système. Les textes arabes et leur sens de lecture sont préservés.

La palette source est `branding/palette.json`. Les fichiers générés sont
`web/app/brand-tokens.css`, `mobile/theme.ts` et `mobile/brand-config.json`.
Les styles web et mobiles utilisent ces couleurs communes.

```sh
npm run brand:sync
```

Cette commande synchronise la palette, exporte les logos et icônes depuis les
maîtres v3, vérifie les formats et contrôle les contrastes des couples principaux.
Les images source restent des PNG, sans prétendre être des fichiers vectoriels.

## Livraisons

Le pack de production doit être régénéré après chaque changement d'identité.
Le nouvel APK local conserve son statut de test ; les versions signées de
publication restent à générer avec le domaine et les credentials définitifs.
