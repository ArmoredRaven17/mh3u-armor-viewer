// THIS VIEWER'S DATA, MAPPED FOR THE SHARED BASE (docs/base; the plan: C:\\Coding Repos\\VIEWER-BASE-PLAN.md). The base's
// modules never read armor.json or weapons.json themselves: what they need comes through here. Each function reads the
// app's live objects through `app`, set once at the top of the page (setApp): DATA (armor.json), state (the hunter on
// screen), worn(slot) (the armour record worn there, or null).
let app = null;
export function setApp(a){ app = a; }

const rgbHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

// THE PIECE'S OWN PIGMENT (Default, base/ui/pigment.js): armour record +5 into the game's 44-colour table (0x895754 ->
// 0x893e14; the armour pigment routine 0x8fd62c falls back to it when the piece carries no colour of its own). Null when
// nothing is worn: the slot then shows the inner wear, which takes no pigment row.
export function defaultPigHex(slot){
  const r = app.worn(slot);
  if (!r) return null;
  const c = app.DATA.colors.pigments[r.pig];
  return c ? rgbHex(c) : null;
}

// WHETHER THE PIECE WORN IN A SLOT TAKES A PIGMENT (the rows' disabled state): the game lets a piece carry a colour of
// its own only when its record +4 is 2 (0x8fd62c); any other piece keeps its default.
export function dyeable(slot){
  const r = app.worn(slot);
  if (!r) return { can: false, reason: 'Nothing is worn in this slot' };
  if (!r.dye) return { can: false, reason: 'The game does not let this piece be dyed (armor record +4 is not 2): it keeps its own color' };
  return { can: true };
}

// ---- THE ARMOR LISTS (base/ui/armor-panel.js): the game's own table order, grouped by rarity ----
// One item per (model, default pigment, dyeable) this gender can wear, named by every piece in it -- a Blademaster and a
// Gunner piece usually share one -- valued by the first record's id (a record id is what a slot holds: pieces sharing a
// model can carry different default pigments, and the record is what the game colours by). Grouped by the rarity of the
// item's first record (record +7, READ: 0x893f38), as the GU lists are. `type` is the Type filter: 'all', 'b'
// (Blademaster) or 'g' (Gunner).
const pad3 = n => String(n).padStart(3, '0');
// The item's value comes from the whole list (Both), so one item keeps one value under every Type filter: the panel
// re-inserts the worn item by value when the filter would hide it.
export function armorOptions(slot, type){
  const g = app.state.g;
  const groups = new Map();
  for (const r of app.DATA.armor[slot]){
    if (r.wear.indexOf(g) < 0) continue;
    const k = r[g] + ':' + r.pig + ':' + (r.dye ? 1 : 0);
    if (!groups.has(k)) groups.set(k, { id: r.id, model: r[g], rare: r.rare, ids: [], names: [] });
    const e = groups.get(k);
    e.ids.push(r.id);
    // the name and the Type filter count the pieces of that type only; a helm by its set's type (armor.json `type`):
    // the game's own record lets either type wear almost every helm, which Settings' "Treat Head Armors as
    // Blademaster/Gunner" shows (the base asks for 'all' then)
    const kind = slot === 'helm' && r.type ? r.type : r.wear;
    if (type !== 'all' && kind.indexOf(type) < 0) continue;
    if (e.names.indexOf(r.name) < 0) e.names.push(r.name);
  }
  const out = [];
  for (const e of groups.values()){
    if (!e.names.length) continue;                 // no piece of this type in it
    if (!app.DATA.pieces[g + '/' + g + '_' + slot + pad3(e.model)]) continue;
    out.push({ value: String(e.id), label: e.names.join(' / '), model: e.model, ids: e.ids, rare: e.rare,
               // the label a worn piece shows when the filter hides it is the 'all' list's, which names every piece
               group: 'Rarity ' + e.rare });
  }
  // One group per rarity, ascending, the game's table order kept inside each (a stable sort). GU's forge list is
  // rarity-ascending already, so its groups break in forge order; 3U's armour table is not (it runs set by set), and
  // breaking on every change made 83 Head groups, a "Rarity N" heading every few rows.
  return out.sort((a, b) => a.rare - b.rare);
}
// the entries above a slot's list: none (GU's Chakra is GU's)
export function armorSpecials(){ return []; }
// the item a record id belongs to, for a slot holding a record that is not an item's first (an older save, or a record
// another gender's list grouped differently)
export function legacyModel(slot, v){
  const id = +v;
  if (!Number.isInteger(id) || id <= 0) return null;
  const r = app.DATA.armor[slot].find(x => x.id === id);
  return r ? r[app.state.g] : null;
}
// the token the select holds for a record id: the value of the item that lists it ('none' for nothing)
export function tokenOfRecord(slot, id, type){
  if (!id) return 'none';
  const o = armorOptions(slot, type || 'all').find(x => x.ids.indexOf(id) >= 0);
  return o ? o.value : 'none';
}

// ---- THE HUNTER PANEL'S LISTS (base/ui/hunter-panel.js) ----
// the face and hair styles of the gender shown, in the game's order; they have no names in game, so Type 1..N
export function charStyles(part){
  return (app.DATA.chars[app.state.g][part] || []).map((e, i) => ({ label: 'Type ' + (i + 1), rec: e }));
}
// 3U has no face paint
export function paintCount(){ return 0; }
// the inner wear: the game's four clothing models (60-63 for body, arm and leg, 0x892a14), Type 1..4
export function clothingOptions(){
  const n = Math.max(...Object.values(app.DATA.inner).map(a => a.length));
  return Array.from({ length: n }, (_, i) => ({ value: String(i), label: 'Type ' + (i + 1) }));
}
// the hunter's motions: the game's common lists (player\mot\plcom), a group per list, its clips the entries (the clips
// carry no names in the game data); the option value is 'g:<index>' into this flat list
export function poseOptions(){
  const P = app.DATA.poses && app.DATA.poses[app.state.g];
  const out = [];
  for (const l of (P && P.lists) || [])
    for (const c of l.clips)
      out.push({ label: c.clip, group: listName(l.id), src: listName(l.id), clip: c.clip, dur: c.dur, list: l.id });
  return out;
}
export const listName = id => 'List ' + (+id / 100);
// THE PIGMENT SELECTOR'S SECTIONS (base/ui/pigment.js), every colour list the game has (Raven, 2026-10-18: "Any in game
// pigment should be listed", "it doesn't need to be an armor pigment, some pigments exist for dying hair or features of
// the hunter"), armour first (listed 3, 1, 2 below):
//   1. the 12 presets the item box's pigment page offers for armour (records 12..23 of 0xb9b724; 0x3f4c6c labels modes
//      0 / 2 / 3 / 4 with them) -- the Clothing Color and Features pickers' list, so headed with the game's own words
//      for those (StMenu 14 "Clothing Color", 11 "Features"); each named as the game prints it, "1".."12";
//   2. the 12 hair presets (records 0..11; StMenu 12 "Hair Color"), "1".."12";
//   3. the 44 colours of 0xb028a0, each armour record's default (record +5), in table order, repeats kept; the game
//      gives them no names and no heading (notes/armor.md "Colour and pigment NAMES"), so the base's neutral one.
// Then the base adds the game's colour board (game.pigmentBoard). Each preset IS a board pixel (armor.json colors.presets:
// [R, G, B, x, y]).
export function pigmentSections(){
  const C = app.DATA.colors, labels = (window.VIEWER_GAME && window.VIEWER_GAME.presetLabels) || [];
  // the base shows one "Pigments" grid (Raven: no section headings), so each colour names its source for its tooltip
  const presets = (list, src) => list.map((gi, k) => ({ hex: rgbHex(C.presets[gi].slice(0, 3)), name: src + ' ' + (labels[k] || String(k + 1)) }));
  // armour lists first, then the hunter's colour lists (the base's order, base/README.md "The pigment selector")
  return [
    { label: 'Armor pigments', colours: C.pigments.map((c, i) => ({ hex: rgbHex(c), name: 'Armor pigment ' + i })) },
    { label: 'Clothing Color / Features', colours: presets(C.otherPresets, 'Clothing Color / Features') },
    { label: 'Hair Color', colours: presets(C.hairPresets, 'Hair Color') },
  ];
}

// THE WEAPON CLASSES' CANONICAL NAMES, for the base's class order (base/ui/weapon-panel.js orderClasses: GU's Guild Card
// order, Raven 2026-10-18), by the class's folder key -- 3U's twelve (no Charge Blade, no Insect Glaive)
const CLASS_NAME = { w00: 'Great Sword', w01: 'Sword & Shield', w02: 'Hammer', w03: 'Lance', w04: 'Heavy Bowgun',
  w06: 'Light Bowgun', w07: 'Long Sword', w08: 'Switch Axe', w09: 'Gunlance', w10: 'Bow', w11: 'Dual Blades',
  w12: 'Hunting Horn' };
export function weaponClassName(c){ return CLASS_NAME[c.key] || c.name; }

// THE CHARACTER COLOUR ROWS' DEFAULT (base/ui/colour-rows.js, colourRows[part].default): the game's own new hunter's
// colour, written by the new-save routine 0x99b128 (READ; notes/armor.md "NEW-HUNTER COLOURS"): hair 0x7a431eff,
// clothing 0x8ba150ff; both features 0xffffff00 (On / Off byte 0: Off, so no colour). Skin is its strip's own default
// (index 189, white = the routine's 0xffffffff).
const DEFAULT_COLOUR = { hair: '#7a431e', cloth: '#8ba150', feat1: null, feat2: null };
export function defaultColour(part){ return DEFAULT_COLOUR[part] !== undefined ? DEFAULT_COLOUR[part] : null; }

// THE GAME'S LOOP FLAG per clip (base/render/pose.js clipLoop; Raven, 2026-10-19: "play animations based on this flag
// if one exists across games"): the LMT v66 motion entry's s32 loop frame (+0x0c; lmt_fix.py). The converter cut each
// motion by it: loop frame 0 -> "Motion[N]_loop" (the whole motion loops), > 0 -> "Motion[N]_start" (frames before the
// loop frame, played once) + "Motion[N]_loop" (from the loop frame to the end), -1 -> "Motion[N]" (no loop). READ: the
// field per motion and the cut (plcom_0000: Motion[1] 0, Motion[2] 36, Motion[6] -1 match their clip names). INFERRED:
// how the game's motion player acts on it (jump back to the loop frame at the end; -1 holds the last frame) -- the
// consuming instruction is not found yet. `entry` is the pose.play entry (hunter pose or weapon stance); null for a clip
// not cut from a motion, so the base's per-file rule applies.
export function clipLoop(entry){
  const c = entry && entry.clip;
  if (typeof c !== 'string' || !/^Motion\[\d+\]/.test(c)) return null;
  return /_loop$/.test(c);
}
