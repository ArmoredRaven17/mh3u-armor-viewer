// The MH3U Armor Viewer. One figure: a hunter in the game's own armour, played in the game's own common motions. MH3U's
// shading is undecoded, so it draws under generic lighting; the hunter's colours are the game's -- each material's colour
// type picks which of skin, hair, clothing, pigment and the two facial features multiplies its map (armor.json
// _about.colors).
//
// THE SHARED VIEWER BASE (docs/base; the plan: C:\Coding Repos\VIEWER-BASE-PLAN.md; Phase 1.3, 2026-10-18): the render
// core (stage, assets, skeleton, material, materials-db, pose, fx, lens, grid) and the UI -- the Hunter tab (Hunter
// Slots, Armor Pieces, Pigment, Weapon, Hunter, Guild Info), the Animation, Lighting, Camera and Effects panels, the
// camera bar, capture and Save / Open -- are the base's, GU's markup and behaviour ("Follow the GU app whenever
// possible"). This file is MH3U's: its data (docs/adapter.js maps it for the base), its per-unit colour rules, the helm's
// hair and face masks, the inner wear, the weapon mount and its stances, the session and set shapes. render/piece.js
// builds one player model the way the MH3U Monster Viewer builds a monster.
//
// Data (build_armor.py, build_armor_poses.py, mh3u_armor.py; see armor.json `_about`):
//   armor.json      the game's five armour tables (names, the model each gender draws, who may wear it, its default
//                   pigment, its rarity), every player model, the clothing drawn under an empty slot, per helm model the
//                   hair and face parts it leaves, the colour choices, the motion lists
//   materials.json  each material's albedo map, blend state and colour type
//   models/<g>      one glb per model           poses/<g>   one glb per motion list
//   ui/td_color.png the game's colour board
import * as THREE from 'three';
import { createStage } from './base/render/stage.js';
import { createFx } from './base/render/fx.js';
import { initAssets, loadJson } from './base/render/assets.js';
import { setBiasUnitsPerStep } from './base/render/material.js';
import { loadMaterialsDb } from './base/render/materials-db.js';
import { PoseDriver } from './base/render/pose.js';
import { playerBone, gidBonesOf } from './base/render/skeleton.js';
import { createFloorGrid } from './base/render/grid.js';
import { loadPiece, applyParts, applyColours, releasePiece } from './render/piece.js';
import * as adapter from './adapter.js';
import { createLightingPanel } from './base/ui/lighting-panel.js';
import { createEffectsPanel } from './base/ui/effects-panel.js';
import { createGuildPanel } from './base/ui/guild-panel.js';
import { createArmorPanel } from './base/ui/armor-panel.js';
import { createHunterPanel } from './base/ui/hunter-panel.js';
import { createWeaponPanel, orderClasses } from './base/ui/weapon-panel.js';
import { createPigment } from './base/ui/pigment.js';
import { createColourRows } from './base/ui/colour-rows.js';
import { createSaveOpen } from './base/ui/save-open.js';
import { createAnimationPanel } from './base/ui/animation-panel.js';
import { createCameraBar } from './base/ui/camera-bar.js';
import { createCapture } from './base/ui/capture.js';
import { createCameraPanel } from './base/ui/camera-panel.js';

// the game this viewer shows, for the shared base (docs/game.js)
const GAME = window.VIEWER_GAME;
// the Weapon panel's class rows: 3U lists none (game.weaponRows), so this only keeps the base's call
const weaponPanel = createWeaponPanel(GAME, {});
// the adapter (docs/adapter.js) reads the app's objects through these, lazily: set before anything asks it
adapter.setApp({ get DATA(){ return DATA; }, get state(){ return state; }, worn: slot => worn(slot) });

// the page's test hooks; base/ui/capture.js hangs its own on it when it is built, so it exists from the start
window.__view = {};
const errEl = document.getElementById('err');
const errors = [];
window.__errors = errors;
function noteError(msg){ errors.push(String(msg)); errEl.textContent = String(msg); }
addEventListener('error', e => noteError('ERROR: ' + e.message));

const DATA = await loadJson('armor.json');
const WEAPONS = await loadJson('weapons.json');      // the game's weapon tables and every weapon model
const MOUNT = await loadJson('mount.json');          // how the game hangs each part on the hunter
await loadMaterialsDb();
const SLOTS = DATA.slots;                            // helm, body, arm, wst, leg
const C = DATA.colors;

const MARGIN = 1.25;
const viewport = document.getElementById('viewport');
const stage = createStage(viewport, { margin: MARGIN });
const { renderer, scene, camera, controls, world } = stage;
const head = stage.lights.head;     // the headlight; the render loop keeps it on the camera
initAssets(renderer);
// post-processing (base/render/fx.js), switched in only when an effect is on: with every effect off the frame is the
// plain renderer.render this app has always drawn
const fx = createFx(renderer, scene);
const SCENE = null;                  // GU's dev scene runs (?scene=); this app has none

let restoring = true;                // the boot fires the same handlers; nothing saves until it is done

// ---- Lighting and Effects: the shared base's panels ------------------------------------------------------------------
const lightPanel = createLightingPanel(GAME, { stage, scene, camera: () => camera, onChange: () => saveState() });
let fxFocusLive = 0, fxFocusTick = 0;
const fxPanel = createEffectsPanel(GAME, { fx: () => fx, focusLive: () => fxFocusLive, onChange: () => saveState() });

// ---- the camera bar's icons ------------------------------------------------------------------------------------------
const ICON = {
  orbit:  '<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="9.6" ry="4.3" transform="rotate(-30 12 12)"/>',
  pan:    '<path d="M12 3.5v17M3.5 12h17M12 3.5 9.6 6M12 3.5 14.4 6M12 20.5 9.6 18M12 20.5 14.4 18M3.5 12 6 9.6M3.5 12 6 14.4M20.5 12 18 9.6M20.5 12 18 14.4"/>',
  camera: '<path d="M3.5 8.6h3.2L8.2 6.5h7.6l1.5 2.1h3.2v10.4H3.5V8.6Z"/><circle cx="12" cy="13.6" r="3.3"/>',
  rec:    '<circle cx="12" cy="12" r="5.6" fill="currentColor" stroke="none"/>',
  stop:   '<rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" stroke="none"/>',
  check:  '<path d="m5 12.6 4.6 4.6L19 7.4"/>',
  eye:    '<path d="M2.5 12c2.4-4 5.6-6 9.5-6s7.1 2 9.5 6c-2.4 4-5.6 6-9.5 6s-7.1-2-9.5-6Z"/><circle cx="12" cy="12" r="3"/>'
};
function setIcon(btn, key){ btn.querySelector('svg').innerHTML = ICON[key]; }
function setLabel(btn, label, tip){ btn.setAttribute('aria-label', label); btn.title = label + ': ' + tip; }

// ---- pose ---------------------------------------------------------------------------------------------------------------
// The game's own common motions, played on an off-screen proxy -- the gender's inner-wear body, which carries every bone
// the motions drive bar the accessory bones 20-23 -- and copied to every piece by bone id each frame (base/render/
// pose.js). An accessory bone, placed differently by each helm and hair, follows its animated parent.
const pose = new PoseDriver({ frame: world, onError: msg => noteError(msg) });
pose.clipLoop = adapter.clipLoop;          // the game's loop flag per clip (the LMT loop frame; adapter.js)
const mounted = {};                       // helm/body/arm/wst/leg/face/hair -> root
function activeMounts(){ return Object.values(mounted); }

// ---- the camera (base/ui/camera-panel.js) ----------------------------------------------------------------------------
const camPanel = createCameraPanel(GAME, {
  get SCENE(){ return SCENE; },
  get activeMounts(){ return activeMounts; },
  get camera(){ return camera; },
  get controls(){ return controls; },
  get figure(){ return 'hunter'; },
  get figureBounds(){ return figureBounds; },
  get fitPlanes(){ return fitPlanes; },
  get fitRenderer(){ return fitRenderer; },
  get fx(){ return fx; },
  get fxPanel(){ return fxPanel; },
  get head(){ return head; },
  get paintSpin(){ return camBar.paintSpin; },
  get playerBone(){ return playerBone; },
  get pose(){ return pose; },
  get renderer(){ return renderer; },
  get restoring(){ return restoring; },
  get saveState(){ return saveState; },
  get setIcon(){ return setIcon; },
  get setLabel(){ return setLabel; },
  get viewport(){ return viewport; },
  get world(){ return world; },
});
const { FLY_SPEED, applyCameraState, applyLens, cameraState, figureCenter, fly, focalOfSlider, focusDistance, leaveFly,
        lensCamera, lensEdit, lensFileState, paintCamMode, paintFlySpeed, paintOrbitLock, setCamMode, setFaceLock,
        setFlySpeed, setFocal, setFov, speedOfSlider, stepFly, viewDistance } = camPanel;

function fitRenderer(){
  stage.fit();
  const sz = renderer.getSize(new THREE.Vector2());
  fx.setSize(sz.x, sz.y, renderer.getPixelRatio(), camPanel.lensState);
}
// THE ONE RENDER ENTRY for the loop, the Screenshot button and the recorder: the composer when an effect is on, the
// plain render through the lens's camera otherwise. The focus ray is cast only while a depth of field is drawing and
// following -- nothing else reads it, and a cast over skinned meshes costs milliseconds.
const _aniso = new THREE.Vector2(1, 1);
function renderFrame(t){
  camPanel.frameNo++;
  const cam = lensCamera();
  plateUpdate(cam);
  const dof = fxPanel.state.dof;
  const following = fx.active && dof.on && dof.follow;
  const focus = following ? focusDistance(t !== undefined) : dof.focus;
  fxFocusLive = focus;
  _aniso.set(camPanel.lensState.type === 'anamorphic' ? 1 / camPanel.lensState.squeeze : 1, 1);
  fx.feed({ time: t === undefined ? performance.now() / 1000 : t,
            mask: document.documentElement.classList.contains('chroma'), aspect: camera.aspect,
            focus, near: cam.near, far: cam.far, ortho: !!cam.isOrthographicCamera, aniso: _aniso });
  if (following && ((++fxFocusTick) % 15) === 0) fxPanel.paintFocusLive();
  if (fx.active) fx.render(cam); else renderer.render(scene, cam);
}

// ---- framing ------------------------------------------------------------------------------------------------------------
// Under a clip a skinned mesh keeps its rest bounds, so the pose driver's own bounds -- the union of the whole loop --
// and its body centre win where it has them.
function figureBounds(){
  const objs = activeMounts();
  if (!objs.length) return null;
  const box = new THREE.Box3();
  if (pose.bounds && !pose.bounds.isEmpty()) box.copy(pose.bounds);
  else objs.forEach(o => box.expandByObject(o));
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  if (pose.center) c.copy(pose.center);
  return { box, size, c };
}
function frameAll(){
  if (camPanel.camMode === 'fly') leaveFly({ keepTarget: true });   // Fit to View is an orbit view
  const fb = figureBounds();
  if (!fb) return;
  const { box, size, c } = fb;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const reachY = Math.max(box.max.y - c.y, c.y - box.min.y) * 2;
  const reachX = Math.max(box.max.x - c.x, c.x - box.min.x) * 2;
  const dist = Math.max((Math.max(size.y, reachY) * 0.5) / Math.tan(vFov / 2),
                        (Math.max(size.x, reachX) * 0.5) / Math.tan(vFov / 2) / camera.aspect) * MARGIN + size.z * 0.5;
  controls.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(0, 0, dist));
  fitPlanes(dist);
  camera.updateProjectionMatrix(); controls.update();
}
document.getElementById('fitBtn').onclick = () => frameAll();
// The clip planes follow the camera's distance every frame (GU's): the near plane set for a quarter-millimetre depth
// step at the target, capped so it never reaches the figure, the far plane twenty distances out with a floor
function fitPlanes(dist){
  if (!(dist > 0)) dist = viewDistance();
  const near = Math.min(dist / 4, Math.max(1e-4, dist * dist / 4194));
  const far = Math.max(50, dist * 20);
  if (Math.abs(near - camera.near) > near * 0.02 || Math.abs(far - camera.far) > far * 0.02){
    camera.near = near; camera.far = far; camera.updateProjectionMatrix();
  }
}
// The ROM's depth bias steps as a fixed push at the model: one step is BIAS_STEP_M, whatever the zoom
const BIAS_STEP_M = 0.0005;
function updateDepthBias(){
  const dist = viewDistance();
  let lsb;
  if (camPanel.lensState.type === 'ortho'){ const rc = lensCamera(); lsb = (rc.far - rc.near) / 16777216; }   // a linear depth buffer
  else lsb = dist * dist / camera.near / 16777216;
  if (lsb > 0) setBiasUnitsPerStep(BIAS_STEP_M / lsb);
}

// ---- the floor grid (base/render/grid.js), a camera bar toggle -----------------------------------------------------
// The floor is where the figure's soles are: the lowest point of its meshes as they stand, taken again whenever the
// pose or the pieces change (GU's rule)
const floorAt = { key: null, y: 0, centre: new THREE.Vector3(), reach: 1 };
function figureFloor(){
  const roots = activeMounts();
  const clip = pose.action ? pose.action.getClip() : null;
  const key = [pose.ground, clip ? clip.uuid : ''].concat(roots.map(r => r.uuid)).join('|');
  if (key === floorAt.key) return floorAt;
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const root of roots) root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2){ o.getVertexPosition(i, v); box.expandByPoint(v.applyMatrix4(o.matrixWorld)); }
  });
  if (box.isEmpty()) return floorAt;
  floorAt.key = key;
  floorAt.y = box.min.y;
  box.getCenter(floorAt.centre);
  floorAt.reach = 0.5 * Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  return floorAt;
}
const floorGrid = createFloorGrid({ scene, floor: () => figureFloor().y,
                                    centre: out => out.copy(figureFloor().centre), reach: () => figureFloor().reach });

// ---- the camera bar and the Camera panel's controls (base/ui/camera-bar.js) ----------------------------------------
const camBar = createCameraBar(GAME, {
  get FLY_SPEED(){ return FLY_SPEED; },
  get SCENE(){ return SCENE; },
  get applyLens(){ return applyLens; },
  get camPanel(){ return camPanel; },
  get controls(){ return controls; },
  get floorGrid(){ return floorGrid; },
  get focalOfSlider(){ return focalOfSlider; },
  get fxPanel(){ return fxPanel; },
  get lensEdit(){ return lensEdit; },
  get paintCamMode(){ return paintCamMode; },
  get saveState(){ return saveState; },
  get setCamMode(){ return setCamMode; },
  get setFaceLock(){ return setFaceLock; },
  get setFlySpeed(){ return setFlySpeed; },
  get setFocal(){ return setFocal; },
  get setLabel(){ return setLabel; },
  get speedOfSlider(){ return speedOfSlider; },
});
// no pointer lock (a touch device): the first-person camera is not offered
if (!('requestPointerLock' in document.body)){
  document.getElementById('flyBtn').hidden = true;
  document.querySelector('#camMode option[value=fly]').disabled = true;
}

// ---- what is worn -------------------------------------------------------------------------------------------------------
const LS_KEY = 'mh3u-armor-viewer';
const CHAIN_KEY_OLD = 'mh3u-armor-viewer-chain';     // the chain's own key before the shared Animation panel
const clone = o => JSON.parse(JSON.stringify(o));
const pad3 = n => String(n).padStart(3, '0');
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// The game's colour board (GUI\Texture\lobby\td_color): every preset IS one of its pixels, at the preset's own x, y.
// Read here for the colours an older save picked as a board pixel { x, y }, which are kept as that pixel's RGB.
const boardImg = new Image();
await new Promise((ok, bad) => { boardImg.onload = ok; boardImg.onerror = bad; boardImg.src = C.board.png; });
const boardData = (() => {
  const cv = document.createElement('canvas'); cv.width = C.board.w; cv.height = C.board.h;
  const cx = cv.getContext('2d'); cx.drawImage(boardImg, 0, 0);
  return cx.getImageData(0, 0, C.board.w, C.board.h).data;
})();
const boardRGB = (x, y) => { const i = (y * C.board.w + x) * 4; return [boardData[i], boardData[i + 1], boardData[i + 2]]; };
const isXY = v => !!v && typeof v === 'object' && Number.isInteger(v.x) && Number.isInteger(v.y);

// A slot holds an ARMOUR RECORD id (0 = nothing), not a model: pieces sharing a model can carry different default
// pigments, and the record is what the game colours by.
// The starting colours are the game's own new hunter's (the new-save routine 0x99b128, READ 2026-10-19; notes/armor.md
// "NEW-HUNTER COLOURS"): hair 0x7a431eff (122, 67, 30), clothing 0x8ba150ff (139, 161, 80), skin 0xffffffff (white,
// strip 189), both features 0xffffff00 -- white with the On / Off byte 0, so Off. The rows start on Default ({ d }),
// which IS that colour; none of the four is one of the 24 presets. Every pigment row starts on Default: the piece's own
// colour, which is what the game draws for a piece nobody dyed.
// A COLOUR (hairC, clothC, feat1, feat2): { d: true } the game's new-hunter colour (Default), { p: k } preset k of its
// row's list, { c: '#rrggbb' } an RGB pick, { off: true } (the features), or an older save's board pixel { x, y }
// (and its untinted { u: true }, which now reads as Default).
// A PIGMENT ROW (pig[slot]): 'default' (the piece's own colour, following the armour), or { on, hex } -- ticked, its
// colour; unticked, undyed (Raven, 2026-10-18, the shared base: "an unticked pigment row means undyed").
const PIG_DEFAULT = { helm: 'default', body: 'default', arm: 'default', wst: 'default', leg: 'default' };
const DEFAULTS = { g: 'f', type: 'all', helm: 0, body: 0, arm: 0, wst: 0, leg: 0, face: 0, hair: 0, cloth: 0,
                   skin: C.skin.default, hairC: { d: true }, clothC: { d: true }, feat1: { d: true }, feat2: { d: true },
                   pig: clone(PIG_DEFAULT),
                   pose: { list: '0000', clip: 'Motion[1]_loop' },
                   // the weapon: class -1 = none; the model and pigment pick one of the class's weapons
                   weapon: { cls: -1, model: 0, pig: 0, drawn: false, stance: 0 } };
function isColourSpec(v){
  return !!v && typeof v === 'object' && (v.off === true || v.u === true || v.d === true || Number.isInteger(v.p) || isXY(v) || isHex(v.c));
}
// a pigment row as saved by this version, or by the one before the shared base (null = Default, { c } = its own colour,
// { x, y } = a board pixel; all of them drawn ticked)
function pigRowOf(v){
  if (v === 'default' || v === null || v === undefined) return 'default';
  if (v && typeof v === 'object'){
    // no ticks any more (the base, Raven 2026-10-18: "keep the pigments enabled at all times"): an unticked row of an
    // older save loads as Default
    if (v.on === false) return 'default';
    if (typeof v.on === 'boolean' && isHex(v.hex)) return { on: true, hex: v.hex.toLowerCase() };
    if (isHex(v.c)) return { on: true, hex: v.c.toLowerCase() };
    if (isXY(v)) return { on: true, hex: rgbHex(boardRGB(v.x, v.y)) };
  }
  return 'default';
}
// A hunter, every field type-guarded onto the defaults: what a save, a slot or an older version of this app wrote is
// never trusted as it stands.
function hunterOf(h){
  const o = clone(DEFAULTS);
  if (!h || typeof h !== 'object') return o;
  if (h.g === 'f' || h.g === 'm') o.g = h.g;
  if (['all', 'b', 'g'].includes(h.type)) o.type = h.type;
  for (const k of SLOTS.concat(['face', 'hair', 'cloth', 'skin'])) if (Number.isInteger(h[k]) && h[k] >= 0) o[k] = h[k];
  // the skin: a texel of the game's strip (its index), or any RGB -- the save holds the skin as a packed RGB word
  // (+0x73e0, 0x3a3a18), so a save-edited colour is a real one
  if (isHex(h.skin)) o.skin = h.skin.toLowerCase();
  if (Number.isInteger(o.skin)) o.skin = Math.min(o.skin, C.skin.strip.length - 1);
  for (const k of ['hairC', 'clothC', 'feat1', 'feat2']) if (isColourSpec(h[k])) o[k] = clone(h[k]);
  if (h.pig && typeof h.pig === 'object') for (const s of SLOTS) o.pig[s] = pigRowOf(h.pig[s]);
  if (h.pose && typeof h.pose === 'object' && typeof h.pose.list === 'string' && typeof h.pose.clip === 'string')
    o.pose = { list: h.pose.list, clip: h.pose.clip };
  const w = h.weapon;
  if (w && typeof w === 'object' && Number.isInteger(w.cls) && (w.cls === -1 || WEAPONS.classes.some(c => c.cls === w.cls)))
    o.weapon = { cls: w.cls, model: Number.isInteger(w.model) ? w.model : 0, pig: Number.isInteger(w.pig) ? w.pig : 0,
                 drawn: w.drawn === true, stance: Number.isInteger(w.stance) && w.stance >= 0 ? w.stance : 0 };
  return o;
}
const state = clone(DEFAULTS);
// v3 is the shared base's session (v2 was the app before it; its hunter reads the same through hunterOf)
let SAVED = null;
try { SAVED = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (_) {}
if (!SAVED || typeof SAVED !== 'object' || (SAVED.v !== 2 && SAVED.v !== 3)) SAVED = null;
const savedAny = (() => { try { return localStorage.getItem(LS_KEY) !== null; } catch (_) { return false; } })();
if (SAVED) Object.assign(state, hunterOf(SAVED));
// the chain: in the session from v3, in its own key before (that shape converted once the pose list exists, below)
let savedChain = SAVED && Array.isArray(SAVED.chain) ? { chain: SAVED.chain, chainLoop: !!SAVED.chainLoop } : null;
if (!savedChain) try { const o = JSON.parse(localStorage.getItem(CHAIN_KEY_OLD) || 'null'); if (o && Array.isArray(o.chain)) savedChain = { old: o }; } catch (_) {}

const pieceRec = (g, slot, model) => DATA.pieces[g + '/' + g + '_' + slot + pad3(model)] || null;
const recById = Object.fromEntries(SLOTS.map(s => [s, new Map(DATA.armor[s].map(r => [r.id, r]))]));
const worn = slot => recById[slot].get(state[slot]) || null;

// The model a slot draws: the worn record's model for this gender; with nothing worn, the game's own fallback -- body,
// arm and leg draw the clothing (inner wear) models, 60-63 by the save's choice (0x892a14), helm and waist draw their
// model 0 (armor.json _about.inner).
function modelFor(slot){
  const r = worn(slot);
  if (r) return r[state.g];
  const inner = DATA.inner[slot];
  return inner ? inner[Math.min(state.cloth, inner.length - 1)] : 0;
}

// ---- the character colours ------------------------------------------------------------------------------------------------
const presetRGB = gi => C.presets[gi].slice(0, 3);
// a colour choice -> [R, G, B] or null (Off)
function rgbOf(spec, list){
  if (!spec || spec.off || spec.u) return null;
  if (spec.p !== undefined) return presetRGB(list[spec.p]);
  if (isHex(spec.c)) return hexRGB(spec.c);
  if (isXY(spec)) return boardRGB(spec.x, spec.y);
  return null;
}
// A FEATURE IS ON while its ON / OFF BYTE is set -- not by its colour (corrected 2026-10-19; notes/armor.md "Features:
// On / Off"). The save word is R << 24 | G << 16 | B << 8 | onOff (0x3d7224, the menu's On / Off, writes the low byte:
// 0xff on, 0 off; a preset or board pick writes 0xff); 0x3a3a18 copies its bytes in order to player +0x424..+0x427, so
// the little-endian word 0x23f83c tests with & 0xff000000 is that byte. A feature is drawn whatever its colour, red 0
// included, while it is On. In the viewer: On = any chosen colour; Off = the row's Off; Default (the map as drawn) is
// off, as a fresh save's zero word is.
// the game's new-hunter colour of each row (0x99b128): Default ({ d }); a feature's Default is Off
const GAME_DEFAULT = { hairC: [122, 67, 30], clothC: [139, 161, 80], feat1: null, feat2: null };
const featureOn = spec => !!spec && !spec.off && !spec.u && !spec.d && rgbOf(spec, C.otherPresets) !== null;
// a row's colour: its Default is the game's own (GAME_DEFAULT), else the choice
const colourOf = (key, list) => { const s = state[key]; return s && (s.d || s.u) ? GAME_DEFAULT[key] : rgbOf(s, list); };

// THE COLOUR ROWS (the Hunter panel; base/ui/colour-rows.js). Each row lists the game's own presets for it -- the hair its
// 12, the clothing and the two features the other 12 -- labelled as the game labels them ("1".."12", game.presetLabels),
// and Custom, a pixel of the game's colour board, which is where every preset is taken from; the features add Off
// (StMenu 23 "Off", the game's own On / Off for a feature: its own byte in the save word, not its colour). Default is the game's new-hunter colour. RGB... is any
// colour: the save holds each of these as a plain packed RGB word, not a preset index or a board spot (0x3a3a18: hair
// +0x1c, clothing +0x5768, features +0x73e8 / +0x73ec, each R << 24 | G << 16 | B << 8 | 0xff; notes/armor.md "Save ->
// player"), so a save-edited colour is a real in-game colour (Raven, 2026-10-18: "the game supports it via save
// editing"). A feature takes any RGB while it is On, red 0 included. The rows hold their state as the
// base's (a preset's index, '#rrggbb' from the board or RGB..., 'off', null for Default); the hunter keeps it
// as { p }, { c }, { off } and { u } (Default), so a save reads plainly. The tint is this app's (ctx.applyColours): the
// colour types and the per-unit rules below.
const COLOR_ROWS = [
  { key: 'hairC', sel: 'hairColor', part: 'hair', list: C.hairPresets, off: false },
  { key: 'clothC', sel: 'clothColor', part: 'cloth', list: C.otherPresets, off: false },
  { key: 'feat1', sel: 'feat1Color', part: 'feat1', list: C.otherPresets, off: true },
  { key: 'feat2', sel: 'feat2Color', part: 'feat2', list: C.otherPresets, off: true },
];
// the features' tooltip states the game's rule (0x23f83c: the feature's own On / Off byte, not its colour)
const FEATURE_TIP = 'The game turns a feature on or off with its own switch (Off here); any colour you pick turns it on';
GAME.colourParts = COLOR_ROWS.map(r => [r.sel, r.part, Object.assign(
  { names: r.list.map((gi, k) => [GAME.presetLabels[k] || String(k + 1), rgbHex(presetRGB(gi))]) },
  r.off ? { off: 'Off', tip: FEATURE_TIP } : {})]);
// a row's palette button opens the shared pigment selector for it (base/ui/pigment.js openCharacter); built below
// every argument passes through: the row's Default handler and its strip (opts.strip / onIndex) come from the base
const openPalette = (...args) => pigPanel.openCharacter(...args);
for (const r of COLOR_ROWS) GAME.colourRows[r.part] = { board: { image: GAME.pigmentBoard.image, region: C.board.region }, default: true };
const specOfRow = v => v === null || v === undefined || v === 'default' ? { d: true } : v === 'off' ? { off: true }
  : typeof v === 'number' ? { p: v } : isHex(v) ? { c: v.toLowerCase() } : { u: true };
function rowOfSpec(s){
  if (!s || s.u || s.d) return 'default';      // an older save's untinted ({ u }) is Default now: the game has no untinted
  if (s.off) return 'off';
  if (s.p !== undefined) return s.p;
  if (isHex(s.c)) return s.c.toLowerCase();
  if (isXY(s)) return rgbHex(boardRGB(s.x, s.y));
  return null;
}
const colourRows = createColourRows(GAME, {
  get saveState(){ return saveState; },
  scene, openPalette,
  defaultColour: part => adapter.defaultColour(part),
  // the rows' state into the hunter's, then the game's per-unit colours and the features' parts
  applyColours: cc => {
    for (const r of COLOR_ROWS) state[r.key] = specOfRow(cc[r.part]);
    applyAllColours(); applyHelmMasks();
  },
});
colourRows.buildColorLists();
function paintColourRows(){
  for (const r of COLOR_ROWS){ colourRows.charColor[r.part] = rowOfSpec(state[r.key]); colourRows.paintRow(r.part); }
  hunterPanel.setStrip('skinTone', state.skin);
}

// ---- pigment (base/ui/pigment.js) -------------------------------------------------------------------------------------------
// ARMOUR PIGMENT (type 3): the worn piece's own colour, armour record +5 into the game's 44-colour table (0x895754 ->
// 0x893e14); a dyeable piece (record +4 == 2) can carry its own colour instead (0x8fd62c). The rows are the base's: they
// write the colour each row holds into `slotPigment` (the game's bytes, or null for an unticked row), and the setters
// here apply it through the game's own rule -- drawn while the worn piece is dyeable; on a piece that is not, or with
// nothing worn (the inner wear), the piece's own colour, and the row's colour waits for a dyeable piece.
const rowPig = {};
const slotPigment = {};
let colourQueued = false;
function queueColours(){
  if (colourQueued) return;
  colourQueued = true;
  queueMicrotask(() => { colourQueued = false; applyAllColours(); });
}
for (const sl of SLOTS) Object.defineProperty(slotPigment, sl, {
  enumerable: true, get: () => rowPig[sl] || null, set: v => { rowPig[sl] = v || null; queueColours(); } });
function pigmentOf(slot){
  const r = worn(slot);
  if (r && r.dye) return rowPig[slot] || null;            // the row: its colour, or undyed
  return C.pigments[r ? r.pig : 0];
}
const rgb255 = h => isHex(h) ? hexRGB(h) : null;
const pigPanel = createPigment(GAME, {
  SLOTS, slotPigment, rgb255,
  get saveState(){ return saveState; },
  DEVIANTS: [],                                           // GU's; 3U has none
  deviant: { on: false, a: '#000000', b: '#000000', anim: 'fade' },
  deviantMix: () => 0,
  defaultPigHex: slot => adapter.defaultPigHex(slot),
  dyeable: slot => adapter.dyeable(slot),
  dyeableNoneReason: 'None of the pieces worn can be dyed',
  pigmentSections: () => adapter.pigmentSections(),
});
const { followDefaultPig, paintDyeable, pigOnDef, readSlotPigments, applyPigDef } = pigPanel;
const PIG_NONE = pigPanel.PIG_NONE;
// the rows, as the hunter's state holds them
function pigStateOfRows(){
  const o = {};
  for (const sl of SLOTS) o[sl] = pigOnDef.has(sl) ? 'default'
    : { on: document.getElementById('pgOn_' + sl).checked, hex: document.getElementById('pg_' + sl).value.toLowerCase() };
  return o;
}
// the hunter's rows onto the panel: Default rows take the worn piece's own colour (and follow the armour from here)
function applyPigRows(pig){
  applyPigDef(SLOTS.filter(sl => pig[sl] === 'default'));
  for (const sl of SLOTS){
    const v = pig[sl], cb = document.getElementById('pgOn_' + sl), col = document.getElementById('pg_' + sl);
    if (v === 'default'){ const h = adapter.defaultPigHex(sl); cb.checked = !!h; col.value = h || PIG_NONE; }
    else { cb.checked = true; col.value = v.hex; }
  }
  document.getElementById('pgOn_all').checked = false; document.getElementById('pg_all').value = PIG_NONE;
  readSlotPigments(); paintDyeable();
}
// THE DYE MASK: the pigment region (colour type 3) in magenta, every other material dimmed -- exact here, since the game
// marks the region per material. The region also glows magenta, so a dark map still shows it; each material's own
// emissive is kept and put back when the mask goes off.
const maskCb = document.getElementById('maskdbg');
maskCb.title = 'Show which parts of each piece take its pigment: the pigment region in magenta, the rest dimmed';
const MASK_ON = [255, 0, 255], MASK_OFF = [70, 70, 70];
maskCb.onchange = () => applyAllColours();
function dyeMask(root, on){
  if (on) applyColours(root, { 1: MASK_OFF, 2: MASK_OFF, 3: MASK_ON, 4: MASK_OFF, 5: MASK_OFF, 6: MASK_OFF });
  root.traverse(o => {
    const m = (o.isMesh || o.isSkinnedMesh) && o.material;
    if (!m) return;
    if (on && m.color && !m.userData.ct) m.color.setRGB(MASK_OFF[0] / 255, MASK_OFF[1] / 255, MASK_OFF[2] / 255, THREE.SRGBColorSpace);
    if (!m.emissive) return;
    if (on){
      if (!m.userData.maskEmissive) m.userData.maskEmissive = m.emissive.clone();
      if (m.userData.ct === 3) m.emissive.setRGB(0.45, 0, 0.45); else m.emissive.setRGB(0, 0, 0);
    } else if (m.userData.maskEmissive){ m.emissive.copy(m.userData.maskEmissive); delete m.userData.maskEmissive; }
  });
}

// THE GAME'S PER-UNIT COLOUR RULES (0x24bc00..0x24bcd0, 0x23f83c, 0x248bc4): every unit takes the clothing colour (type
// 4); the hair takes the hair colour (1) and no skin; every other unit takes the skin tone (2); the face takes the two
// features (5, 6); an armour slot takes its own pigment (3).
function applyAllColours(){
  const skin = isHex(state.skin) ? hexRGB(state.skin) : C.skin.strip[state.skin];
  const hair = colourOf('hairC', C.hairPresets), cloth = colourOf('clothC', C.otherPresets);
  const f1 = featureOn(state.feat1) ? rgbOf(state.feat1, C.otherPresets) : null;
  const f2 = featureOn(state.feat2) ? rgbOf(state.feat2, C.otherPresets) : null;
  if (mounted.hair) applyColours(mounted.hair, { 1: hair, 4: cloth });
  if (mounted.face) applyColours(mounted.face, { 2: skin, 4: cloth, 5: f1, 6: f2 });
  for (const slot of SLOTS) if (mounted[slot]) applyColours(mounted[slot], { 2: skin, 3: pigmentOf(slot), 4: cloth });
  for (const k of SLOTS.concat(['hair', 'face'])) if (mounted[k]) dyeMask(mounted[k], maskCb.checked);
}

// ---- mounting -----------------------------------------------------------------------------------------------------------
// Each slot loads on its own ticket: a fast scroll through a list fires faster than models load, and a load that comes
// back stale drops its result instead of mounting it.
const shown = {};                         // the record each slot is showing
const ticket = {};
function unmount(k){
  if (mounted[k]){ world.remove(mounted[k]); releasePiece(mounted[k]); delete mounted[k]; delete shown[k]; }
}
async function mountOne(k, rec){
  const t = ticket[k] = (ticket[k] || 0) + 1;
  if (shown[k] === rec && mounted[k]) return;
  if (!rec){ unmount(k); return; }
  const root = await loadPiece(rec, { wire: camBar.wireOn });
  if (t !== ticket[k]){ releasePiece(root); return; }
  unmount(k);
  root.userData.slot = k;
  world.add(root); mounted[k] = root; shown[k] = rec;
}

// THE HAIR AND FACE UNDER A HELM (0x24a9f8 / 0x24a930). The helm's MODEL picks a record per gender; for each hair model
// it gives the hair parts left drawn, and a face mask; a hair model can also take face part 0 away. Then the features
// (0x23f83c): face part 5 is Feature 1 and part 6 Feature 2, each drawn only where the helm leaves it AND the feature is
// on. Parts above the loops' ranges (hair 0-8, face 0-6) keep the all-on they start with.
function applyHelmMasks(){
  const hf = DATA.hairFace[state.g];
  const helm = modelFor('helm');
  const hairMasks = hf.hair[helm], faceMask = hf.face[helm];
  if (mounted.hair && hairMasks) applyParts(mounted.hair, hairMasks[state.hair], 9);
  if (mounted.face && faceMask !== undefined){
    let m = faceMask & (hf.hairClearsFace0[state.hair] ? ~1 : ~0);
    if (!featureOn(state.feat1)) m &= ~(1 << 5);
    if (!featureOn(state.feat2)) m &= ~(1 << 6);
    applyParts(mounted.face, m, 7);
  }
}

let loads = 0;
function setLoading(on){
  loads = Math.max(0, loads + (on ? 1 : -1));
  document.getElementById('loading').hidden = loads === 0;
}
async function refresh(){
  setLoading(true);
  try {
    const g = state.g, chars = DATA.chars[g];
    const jobs = SLOTS.map(slot => mountOne(slot, pieceRec(g, slot, modelFor(slot))));
    jobs.push(mountOne('face', chars.face[state.face] || null));
    jobs.push(mountOne('hair', chars.hair[state.hair] || null));
    jobs.push(refreshWeapon());
    await Promise.all(jobs);
    applyHelmMasks();
    applyAllColours();
    if (camBar.wireOn) camBar.paintWire();
  } catch (e) { noteError(e && e.message || e); }
  finally { setLoading(false); }
  saveState();
}

// ---- the Armor Pieces panel (base/ui/armor-panel.js) --------------------------------------------------------------------
const filterEl = document.getElementById('filter');
const slotSel = Object.fromEntries(SLOTS.map(s => [s, document.querySelector('select[data-slot="' + s + '"]')]));
function selectToken(sel, slot, v){
  sel.value = v;
  if (sel.value !== v && v){
    sel.insertAdjacentHTML('afterbegin', '<option value="' + v + '">' + armorPanel.labelOf(slot, v) + '</option>');
    sel.value = v;
  }
}
// what follows a new piece in a slot: its Default pigment, the rows it allows
function onPieceChange(slot){
  if (pigOnDef.has(slot)) followDefaultPig(slot);
  paintDyeable();
  saveState();
}
const armorPanel = createArmorPanel(GAME, {
  get SAVED(){ return { hunterType: state.type }; },
  SLOTS,
  get gender(){ return state.g; },
  get saveState(){ return saveState; },
  selectToken,
  setSlot: async (slot, v) => { state[slot] = v === 'none' ? 0 : (+v || 0); await refresh(); },
  onPieceChange,
  armorOptions: (slot, type) => adapter.armorOptions(slot, type),
  armorSpecials: slot => adapter.armorSpecials(slot),
  legacyModel: (slot, v, any) => adapter.legacyModel(slot, v, any),
});
// the Type filter is the panel's view; the hunter keeps it (it saves with the slot, as it always has)
document.getElementById('htype').addEventListener('change', e => { state.type = e.target.value; });
// the five selects from the hunter's records, then the panel's lists around them
function paintArmorSelects(){
  document.getElementById('htype').value = state.type;
  armorPanel.hunterType = state.type;
  for (const slot of SLOTS){
    const tok = adapter.tokenOfRecord(slot, state[slot]);
    if (tok === 'none') state[slot] = 0;                 // a record this gender cannot wear
    slotSel[slot].innerHTML = '<option value="' + tok + '"></option>';
    slotSel[slot].value = tok;
  }
  armorPanel.rebuildSelects(filterEl.value);
}

// ---- the Hunter panel (base/ui/hunter-panel.js) -------------------------------------------------------------------------
const poseSel = document.getElementById('pose');
const hunterPanel = createHunterPanel(GAME, {
  charStyles: part => adapter.charStyles(part),
  paintCount: () => adapter.paintCount(),
  clothingOptions: () => adapter.clothingOptions(),
  get clothingDefault(){ return String(state.cloth); },
  poseOptions: () => adapter.poseOptions(),
  facePaint: null,
  get gender(){ return state.g; },
  get saveState(){ return saveState; },
  setGender: g => setGender(g),
  refreshChar: async () => {
    state.face = +document.getElementById('faceStyle').value || 0;
    state.hair = +document.getElementById('hairStyle').value || 0;
    await refresh();
  },
  applyFacePaint(){}, setBody(){},
  setClothing: async () => { state.cloth = +document.getElementById('clothing').value || 0; await refresh(); },
  onPoseChange: v => onPoseChange(v),
  strip: id => id === 'skinTone' ? C.skin.strip : null,
  openPalette,
  // the strip's index while the slider moves, or '#rrggbb' from its RGB... picker (state.skin holds either)
  onStrip: (id, v) => { if (id !== 'skinTone') return; state.skin = isHex(v) ? v.toLowerCase() : +v; applyAllColours(); saveState(); },
});
// the Hunter panel's selects from the hunter's state
function paintHunterRows(){
  document.getElementById('genderSel').value = state.g;
  hunterPanel.buildStyleLists();
  const chars = DATA.chars[state.g];
  state.face = Math.min(state.face, chars.face.length - 1);
  state.hair = Math.min(state.hair, chars.hair.length - 1);
  document.getElementById('faceStyle').value = String(state.face);
  document.getElementById('hairStyle').value = String(state.hair);
  const nCloth = adapter.clothingOptions().length;
  state.cloth = Math.min(state.cloth, nCloth - 1);
  document.getElementById('clothing').value = String(state.cloth);
  rebuildPoseList();
  paintColourRows();
}
// THE HUNTER'S POSE (the Hunter panel's Pose select, GU's): a group per common motion list, its clips the options;
// "Bind Pose" stops the clip. Rebuilt per gender (each gender has its own motion lists).
function poseIndex(){
  const i = adapter.poseOptions().findIndex(p => p.list === state.pose.list && p.clip === state.pose.clip);
  return i >= 0 ? 'g:' + i : '';
}
function rebuildPoseList(){
  const P = poseSet(), lists = (P && P.lists) || [];
  if (!lists.some(l => l.id === state.pose.list)){ state.pose.list = lists.length ? lists[0].id : ''; state.pose.clip = ''; }
  poseSel.innerHTML = '<option value="">Bind Pose</option>';
  hunterPanel.buildPoseList();
  poseSel.value = poseIndex();
  if (!poseSel.value) state.pose.clip = '';
}
function poseFromSelect(){
  const v = poseSel.value;
  const p = /^g:\d+$/.test(v) ? adapter.poseOptions()[+v.slice(2)] : null;
  if (p){ state.pose.list = p.list; state.pose.clip = p.clip; } else state.pose.clip = '';
}
async function onPoseChange(){
  if (!animPanel.chainDriving) animPanel.chainStop();
  sheatheForPose();
  poseFromSelect();
  await playPose(); saveState();
}
async function setGender(g){
  if (g !== 'f' && g !== 'm') return;
  state.g = g;
  // a record the other body cannot wear comes off (paintArmorSelects); the face, hair and clothing keep their index
  paintArmorSelects(); paintHunterRows();
  await refresh();
  for (const sl of SLOTS) if (pigOnDef.has(sl)) followDefaultPig(sl);
  paintDyeable();
  await playPose();
}

// ---- pose playing -----------------------------------------------------------------------------------------------------
function poseSet(){ return DATA.poses && DATA.poses[state.g]; }
function restoreBind(){
  for (const root of Object.values(mounted))
    for (const [node, p, q, s] of (root.userData.bind || [])){ node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); }
}
// What the figure plays: with a weapon DRAWN, its Stance (the class's own motion lists, poses/<g>/wNN_<list>.glb);
// otherwise the Pose select's clip. The Pose select keeps its choice while a stance plays, so sheathing returns to it,
// and picking a pose sheathes the weapon -- the GU rule. `playing` names what the driver is running once it runs, for
// the weapon's per-frame placement (placeWeapon).
let poseTicket = 0, playing = null;
async function playPose(){
  const t = ++poseTicket;
  const P = poseSet();
  const st = await drawnStance();
  if (t !== poseTicket) return;
  if (P && st){
    const c = wClass(state.weapon.cls);
    // stance: true -- a weapon stance, for the base's loop rule (it plays once and holds unless Loop says otherwise)
    await pose.play({ file: 'poses/' + state.g + '/' + c.key + '_' + st.list + '.glb', clip: st.clip, model: P.model, stance: true },
                    { joints: P.joints });
    if (t === poseTicket) playing = { stance: st };
    return;
  }
  const l = P && P.lists.find(x => x.id === state.pose.list);
  if (!P || !l || !state.pose.clip){ pose.stop(); restoreBind(); playing = null; return; }
  await pose.play({ file: l.file, clip: state.pose.clip, model: P.model }, { joints: P.joints });
  if (t === poseTicket) playing = { pose: state.pose.list + ':' + state.pose.clip };
}
function sheatheForPose(){
  if (state.weapon.cls < 0 || !state.weapon.drawn) return;
  state.weapon.drawn = false; weaponDrawnSel.value = '0'; buildStanceList();
}

// ---- weapon -------------------------------------------------------------------------------------------------------------
// THE GAME'S OWN WEAPON MOUNT (C:\MH3U-Extract\mh3u_mount.py, notes/armor.md "Weapon mount"; mount.json). Each part of a
// weapon is its own model with its own little skeleton (joint ids 0-4, not the hunter's). The game's
// cPlayerBase::WeaponCallback places one joint of it -- the part's `mountJoint`, 0 for every part but the Long Sword's
// scabbard (4) -- at the world matrix of a hunter BONE times T(pos) R(rot) S, position in centimetres in the bone's own
// space, rotation in degrees composed Rz Ry Rx (three.js 'ZYX'), scale last. Which bone and which record follow the
// part's carry state: drawn is the hand (bone 8, or 12 for the Dual Blades' second blade), sheathed the back or the
// waist at the class's rest scale; shields stay on the forearm (bone 11), the arrows on the waist (13), the scabbard on
// the back. A model with a carry index (the per-model table 0xbd0c24) rests by its own record instead (mount.json
// carry). Only the skeleton moves: the meshes stay where the glb has them and the skinning carries them, so the weapon
// is never moved twice (three skins a mesh relative to its own world matrix).
//   The weapon's own pigment (colour type 3) is the game's: record +0x18 (+9 for the Bowguns and the Bow) into the RGB
// table 0xb02924 (weapons.json pigments); index 0 is drawn white, as table entry 0.
//   STANCES, FRAME BY FRAME (C:\MH3U-Extract\build_stances.py -> stances/wNN.json). Every frame the game runs, per part,
// 0x239f84 (the carry state, bone and record for the motion id and frame) and then the part type's joint function
// 0x23aec8, which also moves the weapon's own MODE-1 joints (the Bow's limbs, the Switch Axe's slide, the bowguns'
// folding) and sets its part mask. build_stances.py ran exactly that code in an emulator on every frame of every clip of
// the class's three motion lists (and the two lobby motions 313 / 356 that take a sheathed weapon in hand), per group of
// models whose per-model row (0xbd0c24) differs; this plays it back: segment {f, state, joint, pos, rot, scale, rscale?,
// joints?, hide? | show?} at the clip's frame (60 a second).
//   A mode-1 joint (0x23b3d8, mh3u_joint_probe.py): local translation = its bind + the record's position (cm), local
// rotation = R(record, ZYX) x its bind rotation; its scale is the record's. The scale goes on the joint's leaf where it
// has one (the bone its vertices bind to), so it does not carry down the chain -- INFERRED from the converter's MT
// convention, not read in this build.
//   PART VISIBILITY is the part mask the joint function leaves (model +0x108, one bit per mesh part): the Long Sword's
// 0x24751c keeps only part 0 while sheathed, the Heavy Bowgun's drawn idle hides parts 1, 2, 101, 102.
const weaponClassSel = document.getElementById('weaponClass'), weaponModelSel = document.getElementById('weaponModel'),
      weaponDrawnSel = document.getElementById('weaponDrawn'), weaponPoseSel = document.getElementById('weaponPose');
// the classes in GU's Guild Card order (base/ui/weapon-panel.js orderClasses; Raven, 2026-10-18), by their canonical
// names (docs/adapter.js); each class's weapons keep the game's order
const W_CLASSES = orderClasses(WEAPONS.classes, c => adapter.weaponClassName(c));
const wClass = cls => W_CLASSES.find(c => c.cls === cls) || null;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// stances/wNN.json per class key, once; `stances` flattens its three lists in order as "Stance N", as the MHGU Armor
// Viewer numbers them (Stance 1 is list 10's Motion[1]_loop, the drawn idle)
const STANCE_LOADS = new Map(), stanceJson = {};
function loadStances(key){
  if (!STANCE_LOADS.has(key))
    STANCE_LOADS.set(key, loadJson('stances/' + key + '.json').then(S => {
      S.stances = [];
      for (const L of S.lists) for (const c of L.clips) S.stances.push(Object.assign({ list: L.id, label: 'Stance ' + (S.stances.length + 1) }, c));
      return (stanceJson[key] = S);
    }).catch(e => { STANCE_LOADS.delete(key); noteError('stances/' + key + '.json: ' + (e && e.message || e)); return null; }));
  return STANCE_LOADS.get(key);
}
async function drawnStance(){
  const w = state.weapon, c = wClass(w.cls);
  if (!c || !w.drawn) return null;
  const S = await loadStances(c.key);
  return (S && S.stances.length) ? S.stances[Math.min(w.stance, S.stances.length - 1)] : null;
}
const fieldOf = el => el.closest('.field');
function buildStanceList(){
  const w = state.weapon, c = wClass(w.cls), S = c && stanceJson[c.key];
  const list = (S && S.stances) || [];
  if (S && w.stance >= list.length) w.stance = 0;
  weaponPoseSel.innerHTML = list.map((st, i) => '<option value="' + i + '" title="' + esc(adapter.listName(st.list) + ' ' + st.clip +
    ' — ' + st.dur.toFixed(2) + ' s') + '">' + st.label + '</option>').join('');
  weaponPoseSel.value = String(w.stance);
  weaponPoseSel.disabled = !w.drawn || !list.length;
  fieldOf(weaponPoseSel).hidden = w.cls < 0;
}
// a class's list: one item per (model, pigment), named by every weapon that draws it -- as the armour lists
function weaponOptions(cls){
  const c = wClass(cls);
  if (!c) return [];
  const groups = new Map();
  for (const r of WEAPONS.weapons[c.key] || []){
    const k = r.model + ':' + r.pig;
    if (!groups.has(k)) groups.set(k, { model: r.model, pig: r.pig, names: [] });
    const e = groups.get(k);
    if (e.names.indexOf(r.name) < 0) e.names.push(r.name);
  }
  return [...groups.values()];
}
function buildWeaponLists(){
  const w = state.weapon;
  weaponClassSel.innerHTML = '<option value="-1">— none —</option>' +
    W_CLASSES.map(c => '<option value="' + c.cls + '">' + esc(c.name) + '</option>').join('');
  weaponClassSel.value = String(w.cls);
  const opts = weaponOptions(w.cls);
  if (w.cls >= 0 && !opts.some(o => o.model === w.model && o.pig === w.pig) && opts.length){ w.model = opts[0].model; w.pig = opts[0].pig; }
  weaponModelSel.innerHTML = opts.map(o => '<option value="' + o.model + ':' + o.pig + '">' + esc(o.names.join(' / ')) + '</option>').join('');
  weaponModelSel.value = w.model + ':' + w.pig;
  weaponDrawnSel.value = w.drawn ? '1' : '0';
  fieldOf(weaponModelSel).hidden = w.cls < 0;
  fieldOf(weaponDrawnSel).hidden = w.cls < 0;
  buildStanceList();
}
// the mounted parts: { root, node (the mount joint), part (mount.json's), k }
const weaponParts = [];
let weaponShown = '', weaponTicket = 0;
function unmountWeapon(){
  for (const p of weaponParts){ world.remove(p.root); releasePiece(p.root); }
  weaponParts.length = 0; weaponShown = '';
}
async function refreshWeapon(){
  const w = state.weapon, c = wClass(w.cls);
  const key = c ? c.cls + ':' + w.model : '';
  if (key === weaponShown && (key || !weaponParts.length)){ applyWeaponLook(); return; }
  const t = ++weaponTicket;
  if (!c){ unmountWeapon(); return; }
  const M = MOUNT.classes[String(c.cls)];
  // a part the cart has no model for (a Long Sword without a scabbard) is not drawn: the game asks for the file by the
  // weapon's own model number and there is none
  const [loaded] = await Promise.all([Promise.all(c.parts.map(async (name, k) => {
    const rec = WEAPONS.models[c.dir + '/' + name + pad3(w.model)];
    if (!rec || !M || !M.parts[k]) return null;
    const root = await loadPiece(rec, { wire: camBar.wireOn });
    return { root, k, part: M.parts[k] };
  })), loadStances(c.key)]);
  if (t !== weaponTicket){ for (const p of loaded) if (p) releasePiece(p.root); return; }
  unmountWeapon();
  for (const p of loaded){
    if (!p) continue;
    const node = (gidBonesOf(p.root).find(b => b.gid === p.part.mountJoint) || {}).node || null;
    if (!node) continue;
    node.matrixAutoUpdate = false;
    p.node = node;
    world.add(p.root); weaponParts.push(p);
  }
  weaponShown = key;
  buildStanceList();
  applyWeaponLook();
}
// the pigment (the part masks follow the frame: placeWeapon)
function applyWeaponLook(){
  const rgb = WEAPONS.pigments[state.weapon.pig] || WEAPONS.pigments[0];
  for (const p of weaponParts) applyColours(p.root, { 3: rgb });
}
// The timelines on screen and the frame: drawn, the stance the driver plays (its first frame while it loads); sheathed,
// the lobby motion's own when the Pose select plays one that moves the weapon, else the rest look. The variant is the
// one whose models include the weapon's.
function weaponTimeline(){
  const w = state.weapon, c = wClass(w.cls), S = c && stanceJson[c.key];
  if (!S) return null;
  let v = S.ref;
  for (const k in S.variants) if (S.variants[k].models.indexOf(w.model) >= 0){ v = k; break; }
  const frame = pose.action ? Math.floor(pose.action.time * S.fps + 1e-4) : 0;
  if (w.drawn){
    const now = playing && playing.stance && S.stances.indexOf(playing.stance) >= 0;
    const st = now ? playing.stance : S.stances[w.stance];
    return st ? { parts: (st.v && st.v[v]) || st.parts, frame: now ? frame : 0 } : null;
  }
  const pp = playing && playing.pose && S.pose[playing.pose];
  return pp ? { parts: pp.v[v], frame } : { parts: S.rest[v], frame: 0 };
}
function segmentAt(tl, frame){
  let s = tl[0];
  for (const x of tl){ if (x.f > frame) break; s = x; }
  return s;
}
// the part's placement on this frame -- or, without its class's stances, mount.json's for the carry on screen
function placementOf(p, T){
  if (T === undefined) T = weaponTimeline();
  const tl = T && T.parts[p.k];
  if (tl && tl.length) return segmentAt(tl, T.frame);
  const w = state.weapon, pl = carryPlacement(p, w.drawn ? p.part.drawn : p.part.sheathed);
  // the Long Sword (0x24751c, types 7 and 18): sheathed shows part 0 alone; drawn, every part
  return (w.cls === 7 && pl.state === 2) ? Object.assign({}, pl, { show: [0] }) : pl;
}
// mount.json's placement, with the model's own rest record where it has one
function carryPlacement(p, pl){
  const w = state.weapon;
  if (pl.state === 2 && p.part.type !== 16 && p.part.type !== 18){
    const ci = MOUNT.carry.byModel[w.cls + ':' + w.model];
    if (ci){
      const r = MOUNT.carry.records[ci + (p.part.type === 17 ? 1 : 0)];
      if (r) return Object.assign({}, pl, { pos: r.pos, rot: r.rot });
    }
    const sp = MOUNT.special[w.cls + ':' + w.model];
    if (sp) return Object.assign({}, pl, { pos: sp.pos, rot: sp.rot });
  }
  return pl;
}
const _wm = new THREE.Matrix4(), _wl = new THREE.Matrix4(), _wi = new THREE.Matrix4();
const _we = new THREE.Euler(), _wq = new THREE.Quaternion(), _wp = new THREE.Vector3(), _ws = new THREE.Vector3(), _wv = new THREE.Vector3();
const DEG = Math.PI / 180;
// the weapon's mode-1 joints: every joint but the mount goes back to its bind, then takes the frame's record
function poseWeaponJoints(p, pl){
  if (!p.joints){
    const bind = new Map((p.root.userData.bind || []).map(([o, ps, q, sc]) => [o, [ps, q, sc]]));
    p.joints = gidBonesOf(p.root).filter(b => b.node !== p.node && bind.has(b.node))
      .map(b => ({ gid: b.gid, node: b.node, leaf: b.leaf, bind: bind.get(b.node), leafScale: b.leaf && bind.has(b.leaf) ? bind.get(b.leaf)[2] : null }));
  }
  const recs = pl.joints || [];
  for (const j of p.joints){
    j.node.position.copy(j.bind[0]); j.node.quaternion.copy(j.bind[1]); j.node.scale.copy(j.bind[2]);
    if (j.leaf && j.leafScale) j.leaf.scale.copy(j.leafScale);
    const r = recs.find(x => x[0] === j.gid);
    if (!r) continue;
    j.node.position.add(_wv.set(r[1][0] / 100, r[1][1] / 100, r[1][2] / 100));
    _we.set(r[2][0] * DEG, r[2][1] * DEG, r[2][2] * DEG, MOUNT.order);
    j.node.quaternion.premultiply(_wq.setFromEuler(_we));
    ((j.leaf && j.leafScale) ? j.leaf : j.node).scale.multiply(_wv.fromArray(r[3]));
  }
}
// the part mask: `show` lists the parts it keeps, `hide` the parts it clears; the stand-in layer stays off
function maskWeapon(p, pl){
  const key = pl.show ? 's' + pl.show.join() : pl.hide ? 'h' + pl.hide.join() : '';
  if (key === p.mask) return;
  p.mask = key;
  p.root.traverse(o => {
    if (!(o.isMesh || o.isSkinnedMesh) || o.userData.proxy) return;
    const part = o.userData.part;
    o.visible = pl.show ? pl.show.indexOf(part) >= 0 : !(pl.hide && pl.hide.indexOf(part) >= 0);
  });
}
// every frame, after the pose: each part's mount joint = the bone's world * T R S, written as the joint's local matrix
// under its own parent
function placeWeapon(){
  if (!weaponParts.length) return;
  const roots = Object.values(mounted);
  const T = weaponTimeline();
  for (const p of weaponParts){
    const pl = placementOf(p, T);
    const bone = playerBone(roots, pl.joint);
    p.root.visible = !!bone;
    if (!bone) continue;
    bone.updateWorldMatrix(true, false);
    _we.set(pl.rot[0] * DEG, pl.rot[1] * DEG, pl.rot[2] * DEG, MOUNT.order);
    _wq.setFromEuler(_we);
    _wp.set(pl.pos[0] / 100, pl.pos[1] / 100, pl.pos[2] / 100);     // cm -> the models' metres
    // the model's scale (0x239f84's return, written to model +0x60) times the mount record's own
    const rs = pl.rscale;
    if (rs) _ws.set(pl.scale * rs[0], pl.scale * rs[1], pl.scale * rs[2]); else _ws.setScalar(pl.scale);
    _wl.compose(_wp, _wq, _ws);
    _wm.multiplyMatrices(bone.matrixWorld, _wl);
    const parent = p.node.parent;
    parent.updateWorldMatrix(true, false);
    p.node.matrix.multiplyMatrices(_wi.copy(parent.matrixWorld).invert(), _wm);
    p.node.matrixWorldNeedsUpdate = true;
    poseWeaponJoints(p, pl);
    maskWeapon(p, pl);
    p.root.updateMatrixWorld(true);
  }
}
weaponClassSel.onchange = async () => {
  const cls = +weaponClassSel.value;
  if (!animPanel.chainDriving) animPanel.chainStop();
  state.weapon.cls = cls; state.weapon.stance = 0;       // Stance 1, the class's drawn idle
  const opts = weaponOptions(cls);
  if (opts.length){ state.weapon.model = opts[0].model; state.weapon.pig = opts[0].pig; }
  buildWeaponLists(); await refreshWeapon(); await playPose(); saveState();
  animPanel.paintChain();                                // another class's stances go muted, this one's play
};
weaponModelSel.onchange = () => {
  const [m, g] = weaponModelSel.value.split(':').map(Number);
  state.weapon.model = m; state.weapon.pig = g;
  refreshWeapon().then(saveState);
};
weaponDrawnSel.onchange = async () => { animPanel.chainStop(); await applyWeaponState(); saveState(); };
weaponPoseSel.onchange = async () => { animPanel.chainStop(); await applyWeaponState(); saveState(); };
// what the Weapon panel's Carry and Stance and the Pose select say, on screen: the Animation panel's chain and previews
// set those controls and call this (base/ui/animation-panel.js applyWeaponState)
async function applyWeaponState(){
  state.weapon.drawn = weaponDrawnSel.value === '1' && state.weapon.cls >= 0;
  if (weaponPoseSel.value !== '') state.weapon.stance = +weaponPoseSel.value;
  poseFromSelect();
  buildStanceList();
  await playPose();
}

// ---- the Animation panel (base/ui/animation-panel.js) ----------------------------------------------------------------------
// A stance is named to the panel by its list and clip ("list|clip"): the clip names repeat across a class's three lists.
const stancesOfClass = () => { const c = wClass(state.weapon.cls); return (c && stanceJson[c.key] && stanceJson[c.key].stances) || []; };
// the old chain's links ({ kind: 'pose', list, clip } / { kind: 'stance', cls, clsName, list, clip, label }) in the
// panel's shape, by this gender's pose list
function chainOfOld(o){
  const poses = adapter.poseOptions(), out = [];
  for (const el of o.chain || []){
    if (!el || typeof el !== 'object' || typeof el.clip !== 'string' || typeof el.list !== 'string') continue;
    if (el.kind === 'pose'){
      const i = poses.findIndex(p => p.list === el.list && p.clip === el.clip);
      if (i >= 0) out.push({ kind: 'pose', value: 'g:' + i, label: el.clip });
    } else if (el.kind === 'stance' && Number.isInteger(el.cls))
      out.push({ kind: 'stance', cls: String(el.cls), clsName: typeof el.clsName === 'string' ? el.clsName : String(el.cls),
                 clip: el.list + '|' + el.clip, label: typeof el.label === 'string' ? el.label : el.clip });
  }
  return { chain: out, chainLoop: !!o.loop };
}
const dummySel = () => ({});
const animPanel = createAnimationPanel(GAME, {
  pose,
  weapon: {
    poses: () => stancesOfClass().map(st => ({ clip: st.list + '|' + st.clip, label: st.label })),
    classJson: () => { const c = wClass(state.weapon.cls); return c ? { name: c.name } : null; },
    // GU's weapon gimmicks (Form, Arrow, Kinsect): 3U shows none of them
    setForm(){}, step(){}, setArrow(){}, setKinsect: async () => {}, setKinsectElement(){}, setKinsectMotion: async () => {},
  },
  weaponClassSel, weaponPoseSel, weaponDrawnSel,
  weaponFormSel: document.getElementById('weaponForm'),
  arrowSel: dummySel(), kinsectSel: dummySel(), kinsectElSel: dummySel(), kinsectMotSel: dummySel(),
  applyWeaponState,
  buildPoseList: () => rebuildPoseList(),
  get saveState(){ return saveState; },
  get SAVED(){ return savedChain && savedChain.old ? chainOfOld(savedChain.old) : savedChain; },
});

// ---- Guild Info (base/ui/guild-panel.js): the Guild Card title words; 3U has no name plate ----------------------------
const HUNTERS = [];
let hunterIndex = 0, hunterBusy = false, hunterRenaming = false, hunterBoot = true;
const guildPanel = createGuildPanel(GAME, {
  get HUNTERS(){ return HUNTERS; },
  get activeMounts(){ return activeMounts; },
  get figure(){ return 'hunter'; },
  get figureCenter(){ return figureCenter; },
  get hunterIndex(){ return hunterIndex; },
  get playerBone(){ return playerBone; },
  get renderer(){ return renderer; },
  get saveState(){ return saveState; },
  get scene(){ return scene; },
  get weaponClassSel(){ return weaponClassSel; },
});
const { applyPlateFile, paintPlate, plateFileState, plateUpdate, restorePlate } = guildPanel;

// ---- Capture (base/ui/capture.js) ------------------------------------------------------------------------------------------
const capturePanel = createCapture(GAME, {
  get camPanel(){ return camPanel; },
  get camera(){ return camera; },
  get captureName(){ return captureName; },
  get fx(){ return fx; },
  get head(){ return head; },
  get lightPanel(){ return lightPanel; },
  get renderFrame(){ return renderFrame; },
  get renderer(){ return renderer; },
  get setIcon(){ return setIcon; },
  get setLabel(){ return setLabel; },
});
const { recFrame } = capturePanel;
function captureName(ext){
  const who = (HUNTERS[hunterIndex] && HUNTERS[hunterIndex].name) || 'Hunter';
  return 'MH3U ' + who + ' ' + new Date().toISOString().slice(0, 10) + '.' + ext;
}

// ---- the session, the look and the set file -------------------------------------------------------------------------------
// The look (lighting, effects, the Camera panel and the camera bar's settings) rides beside the hunter as `look`; the
// hunter slots as `hunters` / `hunter`; the chain and the Guild Info titles as their own fields.
function lookState(){
  return Object.assign(lightPanel.save(), {
    postfx: fxPanel.save(),
    camera: { fov: +camera.fov.toFixed(2), lens: lensFileState(), orbitLocked: camPanel.orbitLocked,
              spinStep: camBar.spinStep, spinRev: camBar.spinRev, damp: controls.enableDamping,
              zoomCursor: !!controls.zoomToCursor, face: camPanel.faceLock, flySpeed: +fly.speed.toFixed(3),
              wire: camBar.wireOn, cursor: camBar.hideCursor, grid: camBar.floorGridOn } });
}
// every field type-guarded: a save is whatever the last version of the app wrote
function restoreLook(o){
  if (!o || typeof o !== 'object'){ lightPanel.apply('studio'); return; }
  if ((o.lightRig && typeof o.lightRig === 'object') || typeof o.lighting === 'string') lightPanel.restore(o);
  else lightPanel.apply('studio');
  if (o.postfx && typeof o.postfx === 'object') fxPanel.restore(o.postfx);
  const c = o.camera;
  if (!c || typeof c !== 'object') return;
  if (Number.isFinite(c.fov)) setFov(c.fov);
  if (c.lens && typeof c.lens === 'object') applyLens(c.lens);
  if (typeof c.orbitLocked === 'boolean') camPanel.orbitLocked = c.orbitLocked;
  if (typeof c.spinStep === 'number') camBar.spinStep = Math.max(0, c.spinStep | 0) % camBar.SPIN_STEPS.length;
  if (typeof c.spinRev === 'boolean') camBar.spinRev = c.spinRev;
  if (typeof c.damp === 'boolean') controls.enableDamping = c.damp;
  if (typeof c.zoomCursor === 'boolean') controls.zoomToCursor = c.zoomCursor;
  document.getElementById('camDamp').checked = controls.enableDamping;
  document.getElementById('camZoomCursor').checked = !!controls.zoomToCursor;
  if (typeof c.face === 'boolean') setFaceLock(c.face);
  if (Number.isFinite(c.flySpeed)) setFlySpeed(c.flySpeed);
  if (typeof c.wire === 'boolean') camBar.wireOn = c.wire;
  if (typeof c.cursor === 'boolean') camBar.hideCursor = c.cursor;
  if (typeof c.grid === 'boolean') camBar.floorGridOn = c.grid;
  paintOrbitLock(); camBar.paintSpin(); camBar.paintWire(); camBar.paintCursor(); camBar.paintFloorGrid();
}
// the hunter on screen as a set and a slot keep it: its state, with the pigment rows read off the panel
function hunterNow(){ state.pig = pigStateOfRows(); return hunterOf(state); }
function saveState(){
  if (restoring) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(Object.assign({ v: 3 }, hunterNow(), { look: lookState(), plate: plateFileState() },
      hunterSaveState(), animPanel.chainSaveState())));
  } catch (_) {}
}
function currentSet(){
  return { app: 'MH3U Armor Viewer', version: 2, hunter: hunterNow(), lighting: lightPanel.fileState(),
           effects: fxPanel.save(), view: cameraState(), plate: plateFileState() };
}
const isSet = d => !!d && typeof d === 'object' && (d.app === 'MH3U Armor Viewer' || (d.hunter && typeof d.hunter === 'object'));
// A set onto the page: the hunter, then its lighting, effects and Guild Info where it has them, then its view -- or, with
// none or { view: false }, a fresh framing of the hunter. A version 1 set (before the shared base) keeps its lighting as
// the session's shape (lighting + lightRig).
async function applySet(d, opt){
  opt = opt || {};
  if (!d || typeof d !== 'object') d = {};
  Object.assign(state, hunterOf(d.hunter));
  paintArmorSelects(); paintHunterRows(); buildWeaponLists();
  applyPigRows(state.pig);
  await refresh();
  applyPigRows(state.pig);             // the Default rows again, now the pieces are worn
  await playPose();
  if (d.lighting && typeof d.lighting === 'object') lightPanel.applyFile(d.lighting);
  else if ((d.lightRig && typeof d.lightRig === 'object') || typeof d.lighting === 'string') lightPanel.restore(d);
  if (d.effects && typeof d.effects === 'object') fxPanel.restore(d.effects);
  if ('plate' in d || opt.plate) applyPlateFile(d.plate);
  if (!(opt.view !== false && applyCameraState(d.view))) frameAll();
}
const saveOpen = createSaveOpen(GAME, { currentSet, isSet, applySet: d => applyLoadedSet(d) });
async function applyLoadedSet(d){
  if (hunterBusy) return;
  hunterBusy = true; setLoading(true);
  try { await applySet(d, { plate: true }); } finally { hunterBusy = false; setLoading(false); }
  saveState();
}

// ---- hunter slots ---------------------------------------------------------------------------------------------------------------
// The MHGU Armor Viewer's hunter slots (the shared base's Hunter Slots panel). A slot is a named hunter, { name, set }.
// The set is what the page shows of that hunter: what it wears, its face, hair, clothing, colours, pigment, motion and
// weapon (`hunter`, the shape of `state`), its lighting and effects, its Guild Info titles, and its view. Switching banks
// the hunter on screen into its slot and applies the other; a slot without lighting, effects or a view keeps what is on
// screen and frames the hunter. A first visit starts with two slots: the default female hunter and the default male.
const hunterList = document.getElementById('hunterList');
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function freeHunterName(){
  for (let n = 1; ; n++){ const nm = 'Hunter ' + n; if (!HUNTERS.some(h => h.name === nm)) return nm; }
}
{
  const savedHunters = SAVED && SAVED.hunters, savedHunter = SAVED && SAVED.hunter;
  const valid = h => h && typeof h === 'object' && typeof h.name === 'string' && h.name.trim() &&
                     (h.set === null || (h.set && typeof h.set === 'object'));
  if (Array.isArray(savedHunters) && savedHunters.some(h => valid(h) && h.set)){
    for (const h of savedHunters) if (valid(h)) HUNTERS.push({ name: h.name.trim().slice(0, 40), set: h.set, fresh: !!h.fresh });
    hunterIndex = Number.isInteger(savedHunter) && HUNTERS[savedHunter] ? savedHunter : 0;
  } else {
    HUNTERS.push({ name: 'Hunter 1', set: null });          // banked from the page once it is dressed
    if (!savedAny)                                          // a first visit: the other body, untouched
      HUNTERS.push({ name: 'Hunter 2', set: { hunter: Object.assign(clone(DEFAULTS), { g: state.g === 'f' ? 'm' : 'f' }) }, fresh: true });
  }
}
// the view the slot on screen was left with, taken before anything banks over it; the boot puts it back
const bootView = HUNTERS[hunterIndex] && HUNTERS[hunterIndex].set ? HUNTERS[hunterIndex].set.view : null;
function bankHunter(){ if (!hunterBusy && !hunterBoot && HUNTERS[hunterIndex]) HUNTERS[hunterIndex].set = currentSet(); }
// what saveState writes: the slots with the one on screen freshly banked. A hoisted function, so saveState can name it
function hunterSaveState(){
  try {
    bankHunter();
    if (!hunterRenaming) paintHunters();
    return { hunters: HUNTERS.map(h => ({ name: h.name, set: h.set, fresh: h.fresh || undefined })), hunter: hunterIndex };
  } catch (_) { return {}; }
}
function paintHunters(){
  hunterList.innerHTML = HUNTERS.map((h, i) => {
    const g = i === hunterIndex ? state.g : (h.set && h.set.hunter && h.set.hunter.g) || 'f';
    return '<li class="' + (i === hunterIndex ? 'on' : '') + '" data-k="' + i + '" title="' + (i === hunterIndex ? 'The hunter on screen' : 'Switch to this hunter') + '">' +
           '<span class="n">' + (i + 1) + '.</span><span class="lab">' + escHtml(h.name) + '</span>' +
           '<span class="tag">' + (g === 'm' ? 'Male' : 'Female') + '</span></li>';
  }).join('');
  document.getElementById('hunterDelete').disabled = HUNTERS.length < 2;
}
async function switchHunter(k, opt){
  opt = opt || {};
  if (!HUNTERS[k] || (k === hunterIndex && !opt.force) || hunterBusy) return;
  if (!opt.noBank) bankHunter();     // before the busy flag goes up: the bank skips while busy
  hunterBusy = true;
  setLoading(true);
  try {
    const to = HUNTERS[k];
    hunterIndex = k; paintHunters();
    // the Guild Info titles are the hunter's own: a slot without them shows none (GU's rule)
    await applySet(to.set, { plate: true });
    delete to.fresh;
  } finally { hunterBusy = false; setLoading(false); }
  paintPlate();
  saveState();
}
hunterList.onclick = e => {
  const li = e.target && e.target.closest ? e.target.closest('li') : null;
  if (!li || hunterRenaming) return;
  switchHunter(+li.dataset.k);
};
// Copy: a new hunter, a copy of the one on screen
document.getElementById('hunterCopy').onclick = () => {
  if (hunterBusy) return;
  bankHunter();
  HUNTERS.push({ name: freeHunterName(), set: currentSet() });
  hunterIndex = HUNTERS.length - 1;
  paintHunters(); saveState();
};
// New: a hunter of this gender with every Hunter option on its default (GU's): the view's own settings -- the weapon in
// hand, the lighting, the effects and the camera -- stay as they are; the Guild Info titles are the hunter's own, so the
// new one has none
document.getElementById('hunterNew').onclick = async () => {
  if (hunterBusy) return;
  bankHunter();
  const hunter = Object.assign(clone(DEFAULTS), { g: state.g, weapon: clone(state.weapon) });
  HUNTERS.push({ name: freeHunterName(), set: { hunter, view: cameraState() } });
  await switchHunter(HUNTERS.length - 1, { noBank: true });
};
document.getElementById('hunterRename').onclick = () => {
  const li = hunterList.querySelector('li.on'); if (!li || hunterRenaming) return;
  const lab = li.querySelector('.lab'), h = HUNTERS[hunterIndex];
  const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40; inp.value = h.name;
  hunterRenaming = true;
  lab.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = keep => {
    if (done) return; done = true; hunterRenaming = false;
    const v = inp.value.trim();
    if (keep && v) h.name = v.slice(0, 40);
    paintHunters(); saveState();
  };
  inp.onkeydown = ev => { if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); };
  inp.onblur = () => finish(true);
};
document.getElementById('hunterDelete').onclick = async () => {
  if (HUNTERS.length < 2 || hunterBusy) return;
  const h = HUNTERS[hunterIndex];
  if (!confirm('Delete ' + h.name + '? Its look is lost.')) return;
  HUNTERS.splice(hunterIndex, 1);
  const next = Math.min(hunterIndex, HUNTERS.length - 1);
  hunterIndex = -1;
  await switchHunter(next, { noBank: true, force: true });
};
// Reset: the defaults for the hunter on screen -- its gender kept, no armour, the first face, hair and clothing, the
// starting colours and motion, the Studio lighting, no effects and a fresh framing. It replaces a slot's look, so it
// asks first.
document.getElementById('resetBtn').onclick = async () => {
  if (hunterBusy) return;
  const h = HUNTERS[hunterIndex];
  if (!confirm('Reset ' + (h ? h.name : 'the hunter') + ' (' + (state.g === 'm' ? 'male' : 'female') + ') to the defaults? The current look is replaced.')) return;
  filterEl.value = '';
  hunterBusy = true; setLoading(true);
  try {
    await applySet({ hunter: Object.assign(clone(DEFAULTS), { g: state.g }), lighting: { preset: 'studio' }, effects: { preset: 'off' } },
                   { view: false });
  } finally { hunterBusy = false; setLoading(false); }
  saveState();
};

// ---- the loop ---------------------------------------------------------------------------------------------------------------
addEventListener('resize', fitRenderer);
new ResizeObserver(fitRenderer).observe(viewport);
fitRenderer();
renderer.setAnimationLoop(() => {
  if (pose.mixer) pose.step(Object.values(mounted));
  placeWeapon();                           // the weapon follows the bones the pose just set
  fitPlanes(); updateDepthBias();
  animPanel.paintAnim(); animPanel.stepChainHold();
  lightPanel.step();                       // the key light's orbit
  if (camPanel.camMode === 'fly') stepFly(); else controls.update();   // update() would look at the target
  lightPanel.track(); head.position.copy(camera.position);
  renderFrame();
  recFrame();
});

// ---- the boot ---------------------------------------------------------------------------------------------------------------
restoreLook(SAVED && SAVED.look);
paintCamMode(); paintFlySpeed();
paintArmorSelects(); paintHunterRows(); buildWeaponLists();
applyPigRows(state.pig);
await refresh();
applyPigRows(state.pig);                   // the Default rows take the worn pieces' own colours
await playPose();
animPanel.paintChain();
if (SAVED && SAVED.plate) restorePlate(SAVED.plate); else paintPlate();
frameAll();
// the slot on screen comes back with the view it was left with, as the MHGU Armor Viewer's does
if (bootView) applyCameraState(bootView);
restoring = false;
hunterBoot = false;
// the hunter is in (armour, face, hair, weapon and pose): the side panels unlock (base/ui/shell.js, game.panelsUntilReady)
document.dispatchEvent(new Event('viewer-ready'));
bankHunter(); paintHunters(); saveState();   // the hunter on screen into its slot, now that it is dressed

Object.assign(window.__view, { DATA, state, mounted, scene, camera, controls, world, pose, refresh, frameAll, playPose,
                  applyAllColours, applyHelmMasks, renderer, setFocal, setFov, lookState, restoreLook, currentSet, applySet,
                  pigPanel, armorPanel, hunterPanel, animPanel, camPanel, camBar, lightPanel, fxPanel, guildPanel, saveOpen,
                  weaponPanel, slotPigment, pigmentOf,
  weapon: { parts: () => weaponParts.map(p => ({ type: p.part.type, k: p.k, placement: placementOf(p), node: p.node, root: p.root })),
            place: placeWeapon, refresh: refreshWeapon, MOUNT, timeline: weaponTimeline, playing: () => playing,
            stances: stancesOfClass },
  hunters: { list: () => HUNTERS.map((h, i) => ({ name: h.name, g: i === hunterIndex ? state.g : (h.set && h.set.hunter && h.set.hunter.g) || null,
                                                   banked: !!h.set, fresh: !!h.fresh })),
             index: () => hunterIndex, switchTo: k => switchHunter(k) },
  aimPoint: () => camPanel.aimPoint(new THREE.Vector3()).toArray(),
});
