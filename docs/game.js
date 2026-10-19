// THIS VIEWER'S GAME, for the shared viewer base (docs/base; the plan: C:\\Coding Repos\\VIEWER-BASE-PLAN.md). Every value
// the base needs that differs between viewers lives here or in docs/adapter.js, never in a base file. A CLASSIC script,
// loaded before docs/base/ui/hunter-tab.js and docs/base/ui/shell.js, so the theme and the saved view preferences apply
// before the first paint; the page's module reads the same object (window.VIEWER_GAME).
window.VIEWER_GAME = {
  id: 'mh3u',
  // every localStorage key the base writes is this prefix + '-' + a name: -theme, -stage, -ui, -capture, -equipment
  storagePrefix: 'mh3u-armor-viewer',
  // the side panels start shut and stay locked until the hunter is drawn (base/ui/shell.js; app.js sends 'viewer-ready'
  // after the first full load -- armour, face, hair, weapon and pose; Raven, 2026-10-19)
  panelsUntilReady: true,
  // THE THEMES: the MH apps family's hexes, unchanged (so the white-text invariant and the LEGACY_HEX map in
  // base/ui/shell.js hold), with MH3U names and icons. Keep this list identical between the two MH3U apps. A name too
  // long for a swatch is shortened and its full name kept in `icon`, which names the icon file:
  // assets/MonsterIcons/MH3U-<icon or name>_Icon.png, cut from the game's own icon atlas
  // (C:\MH3U-Extract\extract_theme_icons.py).
  themes: [
    { name: "Volvidon", hex: "#570B0B" },
    { name: "Rathalos", hex: "#b51717" },
    { name: "R. Duramboros", hex: "#783E0F", icon: "Rust Duramboros" },
    { name: "Agnaktor", hex: "#C7620E" },
    { name: "Uragaan", hex: "#74631D" },
    { name: "G. Rathian", hex: "#9C8328", icon: "Gold Rathian" },
    { name: "G. Nargacuga", hex: "#436713", icon: "Green Nargacuga" },
    { name: "G. Plesioth", hex: "#67922E", icon: "Green Plesioth" },
    { name: "Deviljho", hex: "#0B570F" },
    { name: "Rathian", hex: "#39993E" },
    { name: "S. Uragaan", hex: "#14503d", icon: "Steel Uragaan" },
    { name: "Zinogre", hex: "#279773" },
    { name: "A. Lagiacrus", hex: "#0C5D68", icon: "Abyssal Lagiacrus" },
    { name: "G. Agnaktor", hex: "#118898", icon: "Glacial Agnaktor" },
    { name: "Nargacuga", hex: "#005984" },
    { name: "Plesioth", hex: "#0080c1" },
    { name: "Brachydios", hex: "#0B2757" },
    { name: "Lagiacrus", hex: "#0b3f97" },
    { name: "Great Wroggi", hex: "#1F0B57" },
    { name: "Great Jaggi", hex: "#4e2fa2" },
    { name: "H. Jhen Mohran", hex: "#62008f", icon: "Hallowed Jhen Mohran" },
    { name: "P. Ludroth", hex: "#8e50ab", icon: "Purple Ludroth" },
    { name: "P. Rathian", hex: "#D4358C", icon: "Pink Rathian" },
    { name: "Qurupeco", hex: "#C8679D" },
    { name: "Duramboros", hex: "#5a411f" },
    { name: "Diablos", hex: "#997c54" },
    { name: "Barroth", hex: "#835A32" },
    { name: "Bullfango", hex: "#B17A47" },
    { name: "Barioth", hex: "#505358" },
    { name: "S. Rathalos", hex: "#7C879B", icon: "Silver Rathalos" },
    { name: "Forbidden", hex: "#1E2025", icon: "Question Mark" },
  ],
  themeDefault: '#1E2025',             // Forbidden, the family default
  themeIcon: function (name) { return 'assets/MonsterIcons/MH3U-' + name.replace(/ /g, '_') + '_Icon.png'; },
  themeIconFallback: 'assets/MonsterIcons/MH3U-Question_Mark_Icon.png',
  // no pane tabs: MH3U's viewer has the hunter alone (GU's second tab is its Palico)
  paneTabs: [],
  // the joints the camera's aim takes, by gid: 4 the head (every helm model is skinned to it alone), 2 the chest (the
  // bone a chest piece leans on most) -- measured from the models' own skin weights (f/m helm001, body001, body060),
  // not read from the ROM
  aimJoints: { head: 4, chest: 2 },
  // the head aim sits this far above the head joint (the skull's base): the default female face's middle, measured
  // (f_face000 bind pose: joint at y 0.509, face box centre 0.555), not read from the ROM
  aimHeadLift: 0.05,
  // the aim's cast recomputes the skinned meshes' bounds first: three keeps a skinned mesh's bounds from the pose it was
  // first measured in, so under a clip the ray was turned away (found on Rathian in the MH3U Monster Viewer, 2026-10-04)
  aimRefreshSkinBounds: true,
  setFileName: 'mh3u-armor-set.json',
  setFileLabel: 'MH3U armor set',
  // THE CHARACTER COLOUR ROWS (base/ui/colour-rows.js): no game-wide name list; each row has its own (the hair its 12
  // presets, the clothing and the features the other 12), set by app.js from armor.json colors once the data is in
  // (colourParts: [select id, part, { names, off }]), with the game's colour board as each row's Custom choice and RGB...
  // (the save holds each as plain RGB; colourRows, also set by app.js)
  colourNames: [],
  colourParts: [],
  colourPartsPalico: [],
  colourRows: {},
  // no bare clothing choice: an empty Chest, Arms or Legs slot always draws the inner wear (0x892a14)
  clothingNone: false,
  // PIGMENT (docs/base/ui/pigment.js): the five armour slots; no Clothing Color pigment row (3U's clothing colour is a
  // character colour, colour type 4, a row in the Hunter panel) and no Palico
  pigmentSlotLabels: { helm: 'Head', body: 'Chest', arm: 'Arms', wst: 'Waist', leg: 'Legs' },
  // each pigment row's label, under its piece in Armor Pieces: the game's own (StMenu_eng.gmd 33..38, READ)
  pigmentRowLabels: { all: 'Pigment: All', helm: 'Pigment: Head', body: 'Pigment: Chest', arm: 'Pigment: Arms',
                      wst: 'Pigment: Waist', leg: 'Pigment: Legs' },
  pigmentCloth: false,
  pigmentPalico: false,
  // the game's colour board (GUI\Texture\lobby\td_color), at the bottom of the Pigment modal's first tab: its 178 x 53
  // pixels, [0, 0] to [177, 52] inclusive (armor.json colors.board)
  pigmentBoard: { image: 'boards/mh3u-td_color.png', region: [0, 0, 177, 52] },
  // no pigmentRainbow: 3U has none. The armour pigment routine 0x8fd62c takes an own-colour RGB, the 44-colour table
  // or the record's default, and nothing animates it; the eight Rainbow colours are absent from the executable (the
  // control: 4U's routine 0xb097f8 finds all eight at 0xb09828). notes/armor.md "Armour pigment application".
  pigmentDeviants: false,
  // THE WEAPON PANEL'S CLASS ROWS: none. 3U's classes add no gauge, oil, mode or charge row of their own here (the game
  // has them; none is read for this viewer), and 3U has no Charge Blade.
  weaponRows: [],
  // THE HUNTER PANEL'S ROWS (base/ui/hunter-tab.js builds them), GU's order with 3U's own character options: the
  // game's Skin Tone is a strip (StMenu; the slider indexes the game's 190-texel skin strip, armor.json colors.skin),
  // the other four colours are the game's preset rows (base/ui/colour-rows.js, their lists set by app.js). There is no face paint, eye colour or skill switch in 3U's character options.
  hunterRows: [
    // the game's own menu words throughout (StMenu_eng.gmd: 8 "Gender", 10 "Face", 16 "Hairstyle", 20 / 21 "Feature 1" /
    // "Feature 2", 12 "Hair Color", 13 "Skin Tone", 9 "Clothing", 14 "Clothing Color"; 49 / 50 "Male" / "Female")
    { kind: 'select', input: 'genderSel', label: 'Gender', options: [['f', 'Female'], ['m', 'Male']] },
    // GU's Face / Hair / Body show-toggles, hidden and held on (Raven, 2026-10-18: the armour's own masks decide what
    // shows, as in game) -- 3U never had them; kept for GU's layout, they change nothing here
    { kind: 'check', input: 'face', label: 'Face', checked: true, hidden: true, always: true },
    { kind: 'select', input: 'faceStyle', label: 'Face' },
    { kind: 'colour', input: 'feat1Color', label: 'Feature 1' },
    { kind: 'colour', input: 'feat2Color', label: 'Feature 2' },
    { kind: 'check', input: 'hair', label: 'Hair', checked: true, hidden: true, always: true },
    { kind: 'select', input: 'hairStyle', label: 'Hairstyle' },
    { kind: 'colour', input: 'hairColor', label: 'Hair Color' },
    { kind: 'check', input: 'body', label: 'Body', checked: true, hidden: true, always: true },
    // rgb: any colour beside the strip -- the save holds the skin as a packed RGB word (+0x73e0, copied by 0x3a3a18), so a
    // save-edited colour is a real one (Raven, 2026-10-18: "I still want RGB to be an option since the game supports it
    // via save editing")
    { kind: 'strip', input: 'skinTone', label: 'Skin Tone', min: 0, max: 189, step: 1, default: 189, rgb: true,
      title: "The game's skin tone slider: each step is one texel of the game's own skin strip" },
    { kind: 'select', input: 'clothing', label: 'Clothing', title: 'The inner wear drawn under an empty Chest, Arms or Legs slot (the game\'s four, 0x892a14)' },
    { kind: 'colour', input: 'clothColor', label: 'Clothing Color', title: 'The clothing colour (colour type 4): every unit takes it, armour included' },
    { kind: 'select', input: 'pose', label: 'Pose', options: [['', 'Bind Pose']] },
  ],
  // the character colour rows' presets: the game labels them "1".."12" (StMenu 92 + i for the hair, 104 + i for the
  // rest, READ; notes/armor.md "Colour and pigment NAMES"). Each preset IS a pixel of the colour board (armor.json
  // colors.presets: [R, G, B, x, y]).
  presetLabels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  hunterNewTitle: 'A new hunter: no armor, the first face, hair and clothing, every Hunter option on its default',
  // GUILD INFO: the Guild Card title words (build_guild_titles.py, notes/armor.md "Guild Card titles"), eight to a page
  // (0x45b7f0), and the name tag (`tag`, below). No hrBands: the 3DS tag takes no rank colour (it is the layout's one
  // colour), so there is no Hunter Rank row.
  guildInfo: {
    titles: 'guild-card-titles.json?v=20261018',
    titlePage: 8,
    // THE NAME TAG (Raven, 2026-10-19: "there is a name tag with weapon icon. However, the colors were white. For now,
    // assume not rank color"): the gathering hall's overhead tag, "<ICON %02d>%s" -- the weapon glyph, then the name
    // (class uIDLobbyNpcMsg, 0x38189c / 0x3826bc, layout GUI\lobby\npc_statusicon; notes/armor.md "HUNTER NAME TAGS").
    tag: {
      // the layout's text Color, read: both text objects of npc_statusicon.gui point into its vector pool at
      // (255, 255, 255, 255); no code on either path sets another colour, and none reads a rank
      colour: '#ffffff',
      // font: left to the base's default. The game draws the tag in GUI\dfont\Dfont_net, a dynamic font: the cart
      // ships only its descriptor (Dfont_net.gfd, 665 glyphs, size 12) and no glyph texture, so there is no game font
      // file to load
      // the <ICON> font's weapon glyphs, <ICON 00> .. <ICON 12> in 14 px cells (build_plate_icons.py: font_icon.gii /
      // .gfd / font_icon_00_GSM_NOMIP.tex)
      icons: 'ui/plate-icons.png?v=20261019', iconCell: 14,
      // the Weapon panel's class value -> its glyph: nn = the weapon class (player data +2), with 5 -> 6 and 13 -> 4
      // (0x38189c); 3U's twelve classes are none of those two, so each is its own number
      iconCells: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12 },
    },
  },
};
// THE BACKDROP'S OLD KEY, read once (as 6ee22a9 did before the shared base): this app's stage key was once the MH3U
// Monster Viewer's ("mh3u-monster-viewer-stage", copied over with the stage code), so the two apps on the one Pages origin
// set each other's backdrop. A visitor with no armour-viewer value yet takes that old value into this app's own key, once;
// the Monster Viewer's own key is left as it is. Here, before base/ui/shell.js reads <prefix>-stage.
(function () {
  try {
    const KEY = window.VIEWER_GAME.storagePrefix + '-stage', OLD = 'mh3u-monster-viewer-stage';
    if (localStorage.getItem(KEY) === null && localStorage.getItem(OLD) !== null)
      localStorage.setItem(KEY, localStorage.getItem(OLD));
  } catch (_) {}
})();
