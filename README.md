# MH3U Armor Viewer

A fan-made 3D viewer for Monster Hunter 3 Ultimate (3DS) armour. Pick a piece for each slot, on
either gender, with the hunter's face, hair, clothing and colours, in the game's own motions.

**Not published yet.**

## What it does

- Every armour piece in the game, both genders, mixed freely across sets, with the game's own
  names; Blademaster / Gunner filter from the game's own wearer flags
- The clothing (inner wear) the game draws under an empty chest, arm or leg slot
- Faces and hairstyles, with the hair and face parts each helm leaves visible
- The game's own colours: Skin Tone, Hair Color, Clothing Color and the two facial Features,
  from the game's own presets and colour board, and each piece's own armour pigment
- The hunter's common motion lists, clip by clip
- Hunter slots, as in the MHGU Armor Viewer: named hunters, each with its own armour, look,
  colours, motion, lighting, effects and view; switch, copy, rename and delete them
- The MHGU viewers' Lighting, Camera and Effects panels: lighting presets and an adjustable light
  rig; an orbit or first-person camera with lens types (fisheye, orthographic, anamorphic,
  tilt-shift) and a focal length; post effects (bloom, depth of field that follows the hunter's
  head, chest or centre, vignette, aberration, grain, colour grading)

**Lighting is generic three.js lighting, not the game's.** MH3U's shading is not decoded, so none
of it is imitated. The Default preset is the rig the viewer has always drawn; the rest are the
MHGU Armor Viewer's presets.

## Running it

No build step. Serve `docs/` with any static file server:

    python dev/serve.py 5595

## Contents

    docs/index.html      the app: markup, styles and logic
    docs/armor.json      the game's armour tables, every player model, the clothing drawn under an
                         empty slot, per helm the hair and face parts it leaves, the colour choices
                         and the motion lists; `_about` says where each comes from
    docs/materials.json  each material's base texture, blend state and colour type
    docs/weapons.json    the game's weapon tables: classes, part names, every weapon's name and
                         model (the Weapon panel is not built yet: the mount is not decoded)
    docs/models/<g>/     armour, clothing, face and hair meshes (.glb)
    docs/models/weapons/ every weapon model (.glb)
    docs/poses/<g>/      the common motion lists, animations only
    docs/tex/            textures, deduplicated by content hash
    docs/ui/td_color.png the game's own colour board
    docs/render/         the render core, copied from the MH3U Monster Viewer

## Where the data comes from

The scripts live beside this repository in `C:\MH3U-Extract` and read a decrypted cart image:

    convert_armor.py       every player model, face and hair through RevilToolset, each checked
                           against its own source header
    mh3u_armor.py          the game's armour tables, read the way the game reads them
    build_armor.py         everything under docs/ but the poses
    build_armor_poses.py   the common motion lists onto each gender's skeleton

Decode notes: `C:\MH3U-Extract\notes\armor.md`. Neither the extract nor the game's files are part
of this repository.

## Credits

See NOTICE.md, and the About dialog in the app.

Monster Hunter 3 Ultimate is © CAPCOM CO., LTD. This is an unofficial fan project and is not
affiliated with or endorsed by Capcom.
