// ══════════════════════════════════════════════════════════════════════
// CINEMA REGISTRY — pure data for Kat Films 4K / Camera Crafts 4K.
//
// Everything the Cinema Studio module (cinemastudio.js) can offer lives
// here as plain data: tiers and their capabilities, camera bodies, lenses,
// focal lengths, apertures, camera "looks" (one-tap rigs), camera moves,
// speed ramps, genres, durations. No DOM, no network, no app state — so the
// engine and UI in cinemastudio.js render FROM this, and adding a lens, a
// move or a whole tier is a data edit rather than a code change.
//
// HONESTY NOTE (carried over from the original module): none of the
// camera/lens/move/speed-ramp values are real API parameters on fal's
// Seedance / FLUX endpoints. They are cinematography vocabulary folded
// into the prompt by the compiler in cinemastudio.js. Entries marked
// `confirmed:true` were read from the Higgsfield reference walkthroughs
// (OCR-confirmed, see history in cinemastudio.js); entries marked
// `added:true` are standard film vocabulary added for a usable picker, not
// claimed to match any reference product's exact list.
//
// LOAD ORDER: before cinemastudio.js. Defines the global CINEMA_GENRES
// (also read by Persona Studio in index.html — keep its {label,frag}
// shape) plus the CS_* registry below.
// ══════════════════════════════════════════════════════════════════════

const CINEMA_GENRES=[
  {label:"General",frag:""},
  {label:"Action/Fight",frag:"high-energy action cinematography, dynamic kinetic movement"},
  {label:"Romance/Emotional",frag:"intimate emotional cinematography, soft warm tones"},
  {label:"Horror/Suspense",frag:"tense suspenseful cinematography, unsettling atmosphere"},
  {label:"Comedy",frag:"bright playful cinematography, comedic timing"},
  {label:"Dialogue/Drama",frag:"grounded dramatic cinematography, natural character-focused framing"},
  {label:"Chase/Pursuit",frag:"kinetic pursuit cinematography, fast tracking movement"},
  {label:"Noir",frag:"film noir cinematography, high-contrast shadows, moody atmosphere"},
  {label:"Epic",frag:"epic sweeping cinematography, grand scale, dramatic grandeur"},
];

// ── CAMERA RIG ────────────────────────────────────────────────────────
// Body / Lens / Focal length / Aperture. "Auto" always means "say nothing".
// `frag` is what the prompt compiler writes; `sub` is the one-line
// description shown on the card. Only "Studio Digital S35 + Premium Modern
// Prime + 35mm" is the pairing confirmed from the reference video; the rest
// is well-known cinematography vocabulary.
const CS_CAMERA_BODIES=[
  {id:"Auto",label:"Auto",sub:"Let the model decide",frag:""},
  {id:"Studio Digital S35",label:"Studio Digital S35",sub:"Balanced studio look",frag:"shot on a Studio Digital S35 camera",confirmed:true},
  {id:"ARRI Alexa",label:"ARRI Alexa",sub:"Filmic highlight roll-off",frag:"shot on an ARRI Alexa camera",added:true},
  {id:"RED Komodo",label:"RED Komodo",sub:"Sharp, punchy digital",frag:"shot on a RED Komodo camera",added:true},
  {id:"Sony Venice",label:"Sony Venice",sub:"Clean, wide latitude",frag:"shot on a Sony Venice camera",added:true},
  {id:"Blackmagic URSA",label:"Blackmagic URSA",sub:"Organic, raw texture",frag:"shot on a Blackmagic URSA camera",added:true},
];
const CS_LENSES=[
  {id:"Auto",label:"Auto",sub:"Let the model decide",frag:""},
  {id:"Premium Modern Prime",label:"Premium Modern Prime",sub:"Clean, sharp, neutral",frag:"Premium Modern Prime lens",confirmed:true},
  {id:"Anamorphic",label:"Anamorphic",sub:"Oval bokeh, horizontal flares",frag:"Anamorphic lens",added:true},
  {id:"Vintage Prime",label:"Vintage Prime",sub:"Soft, low contrast, character",frag:"Vintage Prime lens",added:true},
  {id:"Wide Angle Prime",label:"Wide Angle Prime",sub:"Immersive, expansive frame",frag:"Wide Angle Prime lens",added:true},
  {id:"Telephoto Zoom",label:"Telephoto Zoom",sub:"Compressed, isolated subject",frag:"Telephoto Zoom lens",added:true},
  {id:"Macro",label:"Macro",sub:"Extreme close detail",frag:"Macro lens",added:true},
];
const CS_FOCAL_LENGTHS=["Auto","24mm","35mm","50mm","85mm","100mm","135mm"].map(v=>({id:v,label:v,frag:v==="Auto"?"":v+" focal length"}));
const CS_APERTURES=["Auto","f/1.4","f/1.8","f/2.8","f/4","f/5.6","f/8"].map(v=>({id:v,label:v,frag:v==="Auto"?"":v+" aperture"}));

// One-tap rigs. Each fills Body/Lens/Focal/Aperture at once. "Studio
// Standard" is the confirmed reference pairing; the others are Kosmic Kat's
// own named looks, not copies of any reference product's presets.
const CS_RIG_LOOKS=[
  {id:"studio",label:"Studio Standard",sub:"S35 · Modern Prime · 35mm",body:"Studio Digital S35",lens:"Premium Modern Prime",focal:"35mm",aperture:"Auto"},
  {id:"blockbuster",label:"Blockbuster",sub:"Alexa · Anamorphic · 35mm · f/2.8",body:"ARRI Alexa",lens:"Anamorphic",focal:"35mm",aperture:"f/2.8"},
  {id:"portrait",label:"Intimate Portrait",sub:"Venice · Modern Prime · 85mm · f/1.8",body:"Sony Venice",lens:"Premium Modern Prime",focal:"85mm",aperture:"f/1.8"},
  {id:"verite",label:"Documentary Vérité",sub:"Komodo · Vintage · 35mm · f/4",body:"RED Komodo",lens:"Vintage Prime",focal:"35mm",aperture:"f/4"},
  {id:"epicwide",label:"Epic Wide",sub:"Alexa · Wide Prime · 24mm · f/5.6",body:"ARRI Alexa",lens:"Wide Angle Prime",focal:"24mm",aperture:"f/5.6"},
  {id:"telesnipe",label:"Telephoto Isolation",sub:"Venice · Tele Zoom · 135mm · f/2.8",body:"Sony Venice",lens:"Telephoto Zoom",focal:"135mm",aperture:"f/2.8"},
  {id:"macro",label:"Macro Detail",sub:"URSA · Macro · 100mm · f/4",body:"Blackmagic URSA",lens:"Macro",focal:"100mm",aperture:"f/4"},
];

// ── CAMERA MOVES ──────────────────────────────────────────────────────
// The original 14 (+ Auto) are the confirmed list. `group` drives the
// section headings in the picker; extras are marked added.
const CS_CAMERA_MOVES=[
  {id:"auto",label:"Auto",value:"",group:"Basic",confirmed:true},
  {id:"static",label:"Locked Off",value:"locked-off static camera, no movement",group:"Basic",added:true},
  {id:"pan_l",label:"Pan Left",value:"smooth camera pan to the left",group:"Basic",confirmed:true},
  {id:"pan_r",label:"Pan Right",value:"smooth camera pan to the right",group:"Basic",confirmed:true},
  {id:"tilt_u",label:"Tilt Up",value:"camera tilts upward",group:"Basic",confirmed:true},
  {id:"tilt_d",label:"Tilt Down",value:"camera tilts downward",group:"Basic",confirmed:true},
  {id:"dolly_in",label:"Dolly In",value:"camera dollies in toward the subject",group:"Dolly",confirmed:true},
  {id:"dolly_out",label:"Dolly Out",value:"camera dollies out away from the subject",group:"Dolly",confirmed:true},
  {id:"dolly_l",label:"Dolly Left",value:"camera dollies laterally to the left",group:"Dolly",confirmed:true},
  {id:"dolly_r",label:"Dolly Right",value:"camera dollies laterally to the right",group:"Dolly",confirmed:true},
  {id:"follow",label:"Camera Follows",value:"camera tracks and follows the subject's movement",group:"Dolly",confirmed:true},
  {id:"handheld",label:"Handheld",value:"handheld camera with natural shake, documentary feel",group:"Dynamic",confirmed:true},
  {id:"orbit",label:"Orbit Around",value:"camera orbits slowly around the subject",group:"Dynamic",confirmed:true},
  {id:"drone",label:"Drone Shot",value:"sweeping aerial drone shot",group:"Dynamic",confirmed:true},
  {id:"crane_u",label:"Crane Up",value:"camera cranes upward, revealing the scene",group:"Dynamic",added:true},
  {id:"crane_d",label:"Crane Down",value:"camera cranes downward toward the subject",group:"Dynamic",added:true},
  {id:"whip",label:"Whip Pan",value:"fast whip pan with motion blur",group:"Dynamic",added:true},
  {id:"zoom_in",label:"Zoom In",value:"camera zooms in toward the subject",group:"Lens",confirmed:true},
  {id:"zoom_out",label:"Zoom Out",value:"camera zooms out from the subject",group:"Lens",confirmed:true},
  {id:"dollyzoom",label:"Dolly Zoom",value:"dolly zoom effect, background stretches while the subject stays framed",group:"Lens",added:true},
  {id:"rack",label:"Rack Focus",value:"rack focus shifting from foreground to background",group:"Lens",added:true},
];

// ── SPEED RAMPS ───────────────────────────────────────────────────────
// Basic list (≈ Cinema Studio 2.5; only "Slow-Mo" and "Auto" were legible,
// the rest is a clearly-labelled reasonable set) and the Pro list that is
// the concrete substance of Cinema Studio 3's "enhanced camera and speed
// ramp control" (OCR-confirmed from its Director's Panel).
const CS_SPEED_RAMPS=[
  {id:"auto",label:"Auto",value:""},
  {id:"none",label:"Constant",value:"constant real-time speed throughout, no speed ramping"},
  {id:"slowmo",label:"Slow-Mo",value:"dramatic slow-motion throughout"},
  {id:"rampup",label:"Ramp Up",value:"speed ramps from slow motion into fast real-time motion"},
  {id:"rampdown",label:"Ramp Down",value:"speed ramps from fast motion down into dramatic slow-motion"},
];
const CS_SPEED_RAMPS_PRO=[
  {id:"auto",label:"Auto",value:""},
  {id:"rampup",label:"Ramp Up",value:"speed ramps from slow motion into fast real-time motion"},
  {id:"flashin",label:"Flash In",value:"a rapid flash-cut speed surge into the shot"},
  {id:"flashout",label:"Flash Out",value:"a rapid flash-cut speed surge out of the shot"},
  {id:"bullet",label:"Bullet Time",value:"dramatic bullet-time effect, motion freezes as the camera orbits around the subject"},
  {id:"hero",label:"Hero Moment",value:"motion eases into a slow, powerful hero moment emphasizing the subject"},
];

// ── STYLE SETTINGS (Cinema Studio 3.5-style layer) ────────────────────
// HONEST GAP kept from the original: only one or two names per tab were
// legible in the source, so these lists are incomplete, and "Dreamy" under
// Lighting is a best-effort placement. A separate "Camera Settings" panel
// was seen but its fields were not legible — the Camera Rig above is this
// app's own take on that space, not a copy of it.
const CS_STYLE_SETTINGS={
  palette:{label:"Color Palette",options:[
    {id:"auto",label:"Auto",value:""},
    {id:"neon",label:"Hyper Neon",value:"hyper-saturated neon color grading, vivid electric hues"},
    {id:"raw",label:"Raw Chaos",value:"raw chaotic color grading, gritty desaturated clash of tones"},
  ]},
  lighting:{label:"Lighting",options:[
    {id:"auto",label:"Auto",value:""},
    {id:"overhead",label:"Overhead Fall",value:"dramatic overhead lighting falling downward onto the subject"},
    {id:"dreamy",label:"Dreamy",value:"soft dreamy diffused lighting, gentle glow"},
  ]},
  moveset:{label:"Camera Moveset Style",options:[
    {id:"auto",label:"Auto",value:""},
    {id:"epic",label:"Epic Scale",value:"epic large-scale camera work, sweeping grandeur"},
  ]},
};

// ── DURATION / FRAME ──────────────────────────────────────────────────
// Seedance only accepts specific lengths, so any requested length snaps up
// to the nearest valid one instead of silently failing.
const KAT_FILMS_DURATIONS=[4,5,6,8,10,12,15];
function snapToKatFilmsDuration(seconds){
  return KAT_FILMS_DURATIONS.find(d=>d>=seconds)||KAT_FILMS_DURATIONS[KAT_FILMS_DURATIONS.length-1];
}
const CS_RATIOS=["16:9","9:16","1:1"];
const CS_LOCATION_FRAG="wide establishing shot of the location itself, rich environmental detail, cinematic lighting, no visible characters or people";
const CS_SOULHEX_FRAG="match the color palette, tones and mood of the attached reference image";
const CS_IMAGE_EDIT_MODEL="fal-ai/flux-2/flash/edit";

// ── TIERS ─────────────────────────────────────────────────────────────
// `mode`   which workspace shows it: "video" = Kat Films 4K, "image" =
//          Camera Crafts 4K. Strictly one or the other — full separation,
//          not just different labels.
// `model`  the REAL fal model the tier maps to ("Cinema Studio 3.5" etc. are
//          Higgsfield's own in-house models, not reachable via fal, so no
//          invented endpoints).
// `caps`   which controls the tier unlocks. The UI renders sections purely
//          from this list.
// `empty`  reserved/redirect slots that generate nothing.
const CS_TIERS=[
  {id:"signature1",mode:"video",label:"Kat Films — Signature 1",short:"Signature 1",sub:"Reserved slot — nothing to generate with yet",empty:true},
  {id:"katfilms1",mode:"video",label:"Kat Films 1",short:"Kat Films 1",sub:"≈ Cinema Studio 2.5 — camera selection, style presets, AI Director",
    model:"bytedance/seedance-2.0/fast/text-to-video",
    caps:["genre","style","director","cameraMove","speedRamp","rig","multishot","duration","ratio"]},
  {id:"katfilms1_5",mode:"video",label:"Kat Films 1.5",short:"Kat Films 1.5",sub:"≈ Cinema Studio 3 — adds Pro speed ramps (Flash In/Out, Bullet Time, Hero Moment)",partial:true,
    model:"bytedance/seedance-2.0/text-to-video",
    caps:["genre","style","director","cameraMove","speedRamp","speedRampPro","rig","multishot","duration","ratio"]},
  {id:"katfilms2",mode:"video",label:"Kat Films 2",short:"Kat Films 2",sub:"≈ Cinema Studio 3.5 — adds Style Settings (palette, lighting, moveset)",partial:true,
    model:"bytedance/seedance-2.0/text-to-video",
    caps:["genre","style","director","cameraMove","speedRamp","speedRampPro","styleSettings","rig","multishot","duration","ratio"]},
  // Soul Cinema's structure: four SEPARATELY selectable image models, kept
  // separate (not one tier with checkboxes), all falling back to the same
  // fal-ai/flux/dev — no invented "Soul" endpoint.
  {id:"aicast",mode:"image",label:"AI Cast",short:"AI Cast",sub:"Character building — lives in Persona Studio's Cinema tab, not duplicated here.",empty:true,
    link:{fn:"openPersonaStudioScreen",label:"Open Persona Studio"}},
  {id:"soulhex",mode:"image",label:"Soul HEX",short:"Soul HEX",sub:"Upload a reference image and match its color palette, tones and mood.",
    model:"fal-ai/flux/dev",caps:["genre","style","director","rig","soulHex","ratio"]},
  {id:"cinematiclocations",mode:"image",label:"Cinematic Locations",short:"Locations",sub:"Rich environments with cinematic lighting — describe a place, get 1–10 variations, no characters.",
    model:"fal-ai/flux/dev",caps:["genre","style","director","rig","soulHex","locations","ratio"]},
  {id:"cinematiccameras",mode:"image",label:"Cinematic Cameras",short:"Cinematic Cameras",sub:"Image generation with full camera-rig control. Confirmed pairing: Studio Digital S35 / Premium Modern Prime / 35mm.",
    model:"fal-ai/flux/dev",caps:["genre","style","director","rig","ratio"]},
];

const CS_VIEWS=[
  {id:"home",label:"Studio",sub:"Generate"},
  {id:"project",label:"Project",sub:"Shots in this project"},
  {id:"generations",label:"My Generations",sub:"Everything made here"},
  {id:"elements",label:"My Elements",sub:"Characters"},
  {id:"favorites",label:"My Favorites",sub:"Starred"},
];

const CS_REGISTRY={
  genres:CINEMA_GENRES,bodies:CS_CAMERA_BODIES,lenses:CS_LENSES,focals:CS_FOCAL_LENGTHS,apertures:CS_APERTURES,
  looks:CS_RIG_LOOKS,moves:CS_CAMERA_MOVES,ramps:CS_SPEED_RAMPS,rampsPro:CS_SPEED_RAMPS_PRO,styleSettings:CS_STYLE_SETTINGS,
  durations:KAT_FILMS_DURATIONS,ratios:CS_RATIOS,tiers:CS_TIERS,views:CS_VIEWS,
};
if(typeof module!=="undefined"&&module.exports)module.exports=CS_REGISTRY;
