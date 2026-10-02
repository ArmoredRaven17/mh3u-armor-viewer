# Notices and attribution

## Game content

Monster Hunter 3 Ultimate, and all of its models, textures, animations and data tables, are
© CAPCOM CO., LTD. All rights reserved.

This is an unofficial, non-commercial fan project. It is not affiliated with, endorsed by, or
supported by Capcom. All game assets were extracted from a personally owned copy of the game and
are shown for reference only.

## Tools used to build this

- **RevilLib / RevilToolset** — PredatorCZ (Lukas Cone).
  Converted MT Framework `.mod` meshes to glTF, `.tex` textures to DDS and `.lmt` motion lists
  to animation. https://github.com/PredatorCZ/RevilLib
- **three.js** — rendering, `GLTFLoader`, `OrbitControls`, `SkeletonUtils`. https://threejs.org
- **Pillow** — texture conversion during the build. https://python-pillow.org
- The cart image, its archives, the text tables, the material files and the executable's own
  tables are read by this project's own scripts (see README.md).

## Data

- Armour **names** are the game's own: `Helm_eng.gmd`, `Body_eng.gmd`, `Arm_eng.gmd`,
  `Waist_eng.gmd` and `Leg_eng.gmd`, one string per armour record.
- Which model a piece draws for each gender, who may wear it, its default pigment, the clothing
  drawn under an empty slot, the hair and face parts a helm leaves, the colour choices and the
  colour each material takes are read out of the game's own executable and files.
  `docs/armor.json` `_about` says where each comes from and what is not decoded yet.

## Assets

The UI textures and the MHFU font are shared with the sibling MHGU fan apps.

## Code

The viewer's render modules are copies of the **MH3U Monster Viewer**'s (itself a fork of the
MHGU Monster Viewer by the same author), maintained here independently.
