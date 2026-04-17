import type { ThemeId } from "./types.js";
import { mulberry32, pickInt } from "./rng.js";

/**
 * Procedural “Guess Who”–style busts: flat vector cartoon humans with
 * swappable-feeling but seed-unique combos (headwear, glasses, clothes, etc.).
 * Inspired by classic deduction-board silhouettes — not a 1:1 copy of any IP.
 */

const SKIN = ["#c58b5e", "#a56c44", "#e8b892", "#7d4e32", "#f5d5c4", "#5c4033", "#edb98e", "#9e6542", "#d4a574"];
const HAIR = ["#0f0f10", "#2a1810", "#4a3728", "#6b5344", "#1e293b", "#fde68a", "#f5e6c8", "#5b21b6", "#b45309", "#ec4899", "#f9a8d4", "#14532d", "#e2e8f0"];
const EYE_IRIS = ["#3d2b1f", "#5c4033", "#2563eb", "#0d9488", "#4b5563", "#1e40af", "#6b21a8", "#15803d"];
const ACC_CELEB = ["#f472b6", "#fbbf24", "#38bdf8", "#a78bfa"];
const ACC_GOV = ["#1e3a5f", "#334155", "#0f766e", "#78350f"];
const ACC_TOON = ["#22c55e", "#f97316", "#ec4899", "#06b6d4"];

const LINE = "#1e293b";
const LINE_SOFT = "rgba(30,41,59,0.55)";

const LIP_PINK = "#fda4af";
const LIP_PURPLE = "#c084fc";
const GOLD = "#eab308";

type Eyewear = "none" | "round" | "wayfarer" | "aviator" | "shades";
type Headwear = "none" | "beanie" | "animal_ears" | "rasta" | "headband";
type Outfit = "suit_blue" | "suit_dark" | "shirt_green" | "tank" | "shirt_pink" | "vest";

const OUTFITS: Outfit[] = ["suit_blue", "suit_dark", "shirt_green", "tank", "shirt_pink", "vest"];

function themeAccents(themeId: ThemeId): string[] {
  if (themeId === "celebrities") return ACC_CELEB;
  if (themeId === "government") return ACC_GOV;
  return ACC_TOON;
}

function pickEyewear(rng: () => number): Eyewear {
  const r = rng();
  if (r < 0.2) return "none";
  if (r < 0.38) return "round";
  if (r < 0.56) return "wayfarer";
  if (r < 0.74) return "aviator";
  return "shades";
}

function pickHeadwear(rng: () => number): Headwear {
  const r = rng();
  if (r < 0.55) return "none";
  if (r < 0.68) return "beanie";
  if (r < 0.8) return "animal_ears";
  if (r < 0.92) return "rasta";
  return "headband";
}

function hairBackPath(style: number, hair: string, baldTop: boolean): string {
  if (baldTop) {
    return `<path d="M18 50 Q22 38 32 36 L68 36 Q78 38 82 50 L78 48 Q68 42 50 42 Q32 42 22 48 Z" fill="${hair}" opacity="0.92"/>
      <ellipse cx="28" cy="44" rx="7" ry="10" fill="${hair}"/>
      <ellipse cx="72" cy="44" rx="7" ry="10" fill="${hair}"/>`;
  }
  switch (style) {
    case 0:
      return `<path d="M14 44 Q50 4 86 44 L86 32 Q50 0 14 32 Z" fill="${hair}"/>`;
    case 1:
      return `<path d="M12 48 Q50 2 88 48 L88 30 Q50 -2 12 30 Z" fill="${hair}"/>`;
    case 2:
      return `<path d="M10 52 Q50 -6 90 52 L90 36 Q50 2 10 36 Z" fill="${hair}"/>`;
    case 3:
      return `<path d="M16 46 Q50 10 84 46 L84 26 Q50 6 16 26 Z" fill="${hair}"/>`;
    case 4:
      return `<path d="M14 48 Q50 8 86 48 L84 30 Q50 12 16 30 Z" fill="${hair}"/>`;
    case 5: {
      // “dread” puff silhouette
      let d = `<path d="M14 46 Q50 6 86 46 L86 34 Q50 4 14 34 Z" fill="${hair}"/>`;
      for (let x = 22; x <= 78; x += 8) {
        d += `<ellipse cx="${x}" cy="22" rx="3.5" ry="9" fill="${hair}"/>`;
      }
      return d;
    }
    default:
      return `<path d="M18 48 Q50 12 82 48 L80 32 Q50 10 20 32 Z" fill="${hair}"/>`;
  }
}

function hairFrontPath(style: number, hair: string, baldTop: boolean): string {
  if (baldTop) return "";
  switch (style) {
    case 0:
      return `<path d="M24 40 Q50 34 76 40 Q74 46 50 44 Q26 46 24 40 Z" fill="${hair}" opacity="0.95"/>`;
    case 1:
      return `<path d="M22 38 L50 32 L78 38 L76 44 Q50 42 24 44 Z" fill="${hair}" opacity="0.92"/>`;
    case 2:
      return `<path d="M28 36 Q50 28 72 36 Q70 44 50 40 Q30 44 28 36 Z" fill="${hair}" opacity="0.9"/>`;
    case 3:
      return `<path d="M26 42 Q50 36 74 42 L72 48 Q50 45 28 48 Z" fill="${hair}" opacity="0.88"/>`;
    case 4:
      return "";
    case 5:
      return `<path d="M26 40 Q50 34 74 40 Q72 46 50 43 Q28 46 26 40 Z" fill="${hair}" opacity="0.9"/>`;
    default:
      return `<path d="M26 39 Q50 33 74 39 Q72 45 50 42 Q28 45 26 39 Z" fill="${hair}" opacity="0.9"/>`;
  }
}

function headwearSvg(hw: Headwear, accent: string, hair: string, faceCy: number): string {
  const top = faceCy - 26;
  switch (hw) {
    case "beanie":
      return `<path d="M28 ${top + 6} Q50 ${top - 8} 72 ${top + 6} Q50 ${top + 2} 28 ${top + 6} Z" fill="${hair}" stroke="${LINE}" stroke-width="0.6"/>
        <path d="M30 ${top + 6} Q50 ${top - 2} 70 ${top + 6}" fill="none" stroke="${LINE_SOFT}" stroke-width="1"/>`;
    case "animal_ears":
      return `<g>
        <ellipse cx="30" cy="${top + 4}" rx="9" ry="11" fill="#fda4af" stroke="${LINE}" stroke-width="1"/>
        <ellipse cx="70" cy="${top + 4}" rx="9" ry="11" fill="#fda4af" stroke="${LINE}" stroke-width="1"/>
        <ellipse cx="30" cy="${top + 4}" rx="4" ry="5" fill="#fff7ed"/>
        <ellipse cx="70" cy="${top + 4}" rx="4" ry="5" fill="#fff7ed"/>
      </g>`;
    case "rasta":
      return `<rect x="22" y="${top + 10}" width="56" height="7" rx="2" fill="#15803d"/>
        <rect x="26" y="${top + 10}" width="8" height="7" fill="#eab308"/>
        <rect x="38" y="${top + 10}" width="8" height="7" fill="#dc2626"/>
        <rect x="50" y="${top + 10}" width="8" height="7" fill="#15803d"/>
        <rect x="62" y="${top + 10}" width="8" height="7" fill="#eab308"/>`;
    case "headband":
      return `<path d="M24 ${top + 14} Q50 ${top + 8} 76 ${top + 14} L76 ${top + 18} Q50 ${top + 12} 24 ${top + 18} Z" fill="${accent}" opacity="0.9"/>`;
    default:
      return "";
  }
}

function eyewearSvg(
  kind: Eyewear,
  eyeY: number,
  eyeSpread: number,
  eyeW: number,
  eyeH: number,
): string {
  const lx = 50 - eyeSpread - eyeW - 5;
  const rx = 50 + eyeSpread - eyeW - 5;
  const gw = eyeW * 2 + 10;
  const gh = eyeH * 2 + 8;
  const gy = eyeY - eyeH - 3.5;
  const bridgeY = eyeY;
  const bridge = `<line x1="${lx + gw}" y1="${bridgeY}" x2="${rx}" y2="${bridgeY}" stroke="${LINE}" stroke-width="1.2"/>`;

  switch (kind) {
    case "none":
      return "";
    case "round":
      return `<g fill="none" stroke="${LINE}" stroke-width="1.35" opacity="0.9">
        <rect x="${lx}" y="${gy}" width="${gw}" height="${gh}" rx="3"/>
        <rect x="${rx}" y="${gy}" width="${gw}" height="${gh}" rx="3"/>
        ${bridge}
      </g>`;
    case "wayfarer":
      return `<g opacity="0.92">
        <rect x="${lx - 1}" y="${gy - 1}" width="${gw + 2}" height="${gh + 2}" rx="4" fill="#0f172a" stroke="${LINE}" stroke-width="1.2"/>
        <rect x="${rx - 1}" y="${gy - 1}" width="${gw + 2}" height="${gh + 2}" rx="4" fill="#0f172a" stroke="${LINE}" stroke-width="1.2"/>
        <line x1="${lx + gw + 1}" y1="${bridgeY}" x2="${rx - 1}" y2="${bridgeY}" stroke="${LINE}" stroke-width="1.4"/>
      </g>`;
    case "aviator": {
      const p = (cx: number) =>
        `M${cx - gw / 2} ${gy + gh * 0.55} Q${cx} ${gy - 1} ${cx + gw / 2} ${gy + gh * 0.55} L${cx + gw / 2 - 1} ${gy + gh} L${cx - gw / 2 + 1} ${gy + gh} Z`;
      return `<g opacity="0.9">
        <path d="${p(50 - eyeSpread)}" fill="#14532d" fill-opacity="0.55" stroke="${LINE}" stroke-width="1.1"/>
        <path d="${p(50 + eyeSpread)}" fill="#14532d" fill-opacity="0.55" stroke="${LINE}" stroke-width="1.1"/>
        <line x1="${lx + gw}" y1="${bridgeY}" x2="${rx}" y2="${bridgeY}" stroke="${LINE}" stroke-width="1.2"/>
      </g>`;
    }
    case "shades":
      return `<g opacity="0.94">
        <rect x="${lx - 2}" y="${gy}" width="${gw + 4}" height="${gh}" rx="5" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <rect x="${rx - 2}" y="${gy}" width="${gw + 4}" height="${gh}" rx="5" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <line x1="${lx + gw + 2}" y1="${bridgeY}" x2="${rx - 2}" y2="${bridgeY}" stroke="#334155" stroke-width="1.3"/>
      </g>`;
    default:
      return "";
  }
}

function outfitSvg(kind: Outfit, accent: string): string {
  const y0 = 76;
  switch (kind) {
    case "suit_blue":
      return `<path d="M12 100 L12 ${y0} Q50 70 88 ${y0} L88 100 Z" fill="#1d4ed8"/>
        <path d="M38 ${y0} L50 82 L62 ${y0} L58 100 L42 100 Z" fill="#f8fafc"/>
        <path d="M48 84 L52 84 L51 100 L49 100 Z" fill="#dc2626"/>`;
    case "suit_dark":
      return `<path d="M12 100 L12 ${y0} Q50 70 88 ${y0} L88 100 Z" fill="#1e293b"/>
        <path d="M36 ${y0} L50 80 L64 ${y0} L60 100 L40 100 Z" fill="#f8fafc"/>
        <path d="M48 82 L52 82 L51 100 L49 100 Z" fill="#dc2626"/>`;
    case "shirt_green":
      return `<path d="M14 100 L14 ${y0} Q50 72 86 ${y0} L86 100 Z" fill="#4ade80"/>
        <path d="M40 ${y0} L50 78 L60 ${y0} L58 100 L42 100 Z" fill="#f8fafc"/>
        <path d="M48 80 L52 80 L51 100 L49 100 Z" fill="#dc2626"/>`;
    case "tank":
      return `<path d="M18 100 L20 ${y0 + 4} Q50 74 80 ${y0 + 4} L82 100 Z" fill="#44403c"/>
        <path d="M28 ${y0} L32 100 L36 100 L34 ${y0}" fill="${adjustColor("#44403c", -0.12)}"/>
        <path d="M72 ${y0} L68 100 L64 100 L66 ${y0}" fill="${adjustColor("#44403c", -0.12)}"/>`;
    case "shirt_pink":
      return `<path d="M14 100 L16 ${y0} Q50 73 84 ${y0} L86 100 Z" fill="#fda4af"/>
        <path d="M38 ${y0} L50 79 L62 ${y0}" fill="none" stroke="${LINE_SOFT}" stroke-width="1.2"/>`;
    case "vest":
      return `<path d="M14 100 L14 ${y0} Q50 72 86 ${y0} L86 100 Z" fill="#292524"/>
        ${Array.from({ length: 8 }, (_, i) => {
          const cx = 28 + i * 6;
          const cy = y0 + 10 + (i % 2) * 4;
          return `<circle cx="${cx}" cy="${cy}" r="1.2" fill="#e7e5e4"/>`;
        }).join("")}`;
  }
}

function mouthLipsSvg(lipStyle: number, faceCy: number): string {
  const cy = faceCy + 11;
  switch (lipStyle) {
    case 0:
      return `<ellipse cx="50" cy="${cy}" rx="4.5" ry="3.5" fill="${LIP_PINK}" opacity="0.85"/>
        <ellipse cx="50" cy="${cy - 0.5}" rx="2" ry="1.2" fill="#fff7ed" opacity="0.5"/>`;
    case 1:
      return `<path d="M42 ${cy} Q50 ${cy + 6} 58 ${cy}" stroke="${LINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 2:
      return `<path d="M40 ${cy - 1} Q50 ${cy + 5} 60 ${cy - 1} Q50 ${cy + 2} 40 ${cy - 1}" fill="${LIP_PINK}" opacity="0.9" stroke="${LINE_SOFT}" stroke-width="0.6"/>`;
    default:
      return `<ellipse cx="50" cy="${cy}" rx="5" ry="3.2" fill="${LIP_PURPLE}" opacity="0.75"/>`;
  }
}

function earringsSvg(show: boolean, faceCy: number, faceRx: number): string {
  if (!show) return "";
  const y = faceCy + 4;
  return `<circle cx="${50 - faceRx - 1}" cy="${y}" r="3" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
    <circle cx="${50 + faceRx + 1}" cy="${y}" r="3" fill="none" stroke="${GOLD}" stroke-width="1.8"/>`;
}

function necklaceSvg(show: boolean, accent: string, faceCy: number): string {
  if (!show) return "";
  const y = faceCy + faceCy * 0.22 + 8;
  return `<path d="M38 ${faceCy + 14} Q50 ${y} 62 ${faceCy + 14}" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity="0.85"/>
    <circle cx="50" cy="${y - 1}" r="3.5" fill="${accent}" stroke="${LINE}" stroke-width="0.5"/>`;
}

function cigarSvg(show: boolean, faceCy: number): string {
  if (!show) return "";
  const y = faceCy + 6;
  return `<line x1="58" y1="${y}" x2="78" y2="${y - 2}" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
    <circle cx="78" cy="${y - 2}" r="1.6" fill="#ef4444" opacity="0.7"/>`;
}

/** Returns an SVG string for a square avatar viewBox 0 0 100 100 */
export function avatarSvg(seed: number, themeId: ThemeId): string {
  const rng = mulberry32(seed);
  const skin = SKIN[pickInt(rng, SKIN.length)]!;
  const skinShadow = adjustColor(skin, -0.18);
  const skinHighlight = adjustColor(skin, 0.12);
  const hair = HAIR[pickInt(rng, HAIR.length)]!;
  const iris = EYE_IRIS[pickInt(rng, EYE_IRIS.length)]!;
  const accents = themeAccents(themeId);
  const accent = accents[pickInt(rng, accents.length)]!;

  const outfit = OUTFITS[pickInt(rng, OUTFITS.length)]!;
  const eyewear = pickEyewear(rng);
  let headwear = pickHeadwear(rng);
  const baldTop = rng() > 0.88;
  const hairStyle = pickInt(rng, 7);
  const lipStyle = pickInt(rng, 4);
  const earrings = rng() > 0.7;
  const necklace = rng() > 0.84;
  const cigar = rng() > 0.94;

  if (headwear !== "none" && baldTop) headwear = rng() > 0.5 ? headwear : "none";

  const faceRx = 22 + pickInt(rng, 7);
  const faceRy = 24 + pickInt(rng, 7);
  const faceCy = 46 + pickInt(rng, 4);
  const eyeY = faceCy - 7 + pickInt(rng, 4);
  const eyeSpread = 10 + pickInt(rng, 6);
  const eyeW = 3.5 + pickInt(rng, 3) * 0.5;
  const eyeH = 4.5 + pickInt(rng, 3) * 0.5;
  const pupilR = 1.4 + rng() * 0.85;
  const browLift = pickInt(rng, 4);
  const freckles = rng() > 0.74;
  const blush = rng() > 0.48;
  const facialHairType = rng() > 0.83 ? pickInt(rng, 3) : -1;

  const earH = 6 + pickInt(rng, 4);
  const earW = 2.5 + pickInt(rng, 2);
  const earY = faceCy - 1;

  const id = `av-${(seed >>> 0).toString(16)}`;

  const brows = (() => {
    const y = eyeY - 6 - browLift;
    const tilt = pickInt(rng, 5) - 2;
    return `<path d="M${50 - eyeSpread - 7} ${y + tilt} Q${50 - eyeSpread} ${y - 2} ${50 - eyeSpread + 7} ${y}" stroke="${LINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M${50 + eyeSpread - 7} ${y} Q${50 + eyeSpread} ${y - 2} ${50 + eyeSpread + 7} ${y + tilt}" stroke="${LINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  })();

  const nose = `<path d="M50 ${eyeY + 3} Q48 ${faceCy + 1} 50 ${faceCy + 3}" stroke="${LINE_SOFT}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;

  const eyes = `<ellipse cx="${50 - eyeSpread}" cy="${eyeY}" rx="${eyeW + 2}" ry="${eyeH + 2}" fill="#fff"/>
    <ellipse cx="${50 + eyeSpread}" cy="${eyeY}" rx="${eyeW + 2}" ry="${eyeH + 2}" fill="#fff"/>
    <ellipse cx="${50 - eyeSpread}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="${iris}"/>
    <ellipse cx="${50 + eyeSpread}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="${iris}"/>
    <circle cx="${50 - eyeSpread + 1}" cy="${eyeY - 1}" r="${pupilR.toFixed(2)}" fill="#0f172a"/>
    <circle cx="${50 + eyeSpread + 1}" cy="${eyeY - 1}" r="${pupilR.toFixed(2)}" fill="#0f172a"/>
    <circle cx="${50 - eyeSpread - 0.5}" cy="${eyeY - 2}" r="1.05" fill="#fff" opacity="0.85"/>
    <circle cx="${50 + eyeSpread - 0.5}" cy="${eyeY - 2}" r="1.05" fill="#fff" opacity="0.85"/>`;

  const ears = `<ellipse cx="${50 - faceRx - earW * 0.25}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skin}" stroke="${LINE_SOFT}" stroke-width="0.7"/>
    <ellipse cx="${50 + faceRx + earW * 0.25}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skin}" stroke="${LINE_SOFT}" stroke-width="0.7"/>`;

  const blushLayer = blush
    ? `<ellipse cx="${50 - faceRx * 0.42}" cy="${faceCy + 1}" rx="7" ry="4.5" fill="#f472b6" opacity="0.11"/>
       <ellipse cx="${50 + faceRx * 0.42}" cy="${faceCy + 1}" rx="7" ry="4.5" fill="#f472b6" opacity="0.11"/>`
    : "";

  const freckleLayer = freckles
    ? [0, 1, 2, 3, 4]
        .map(() => {
          const fx = 40 + pickInt(rng, 22);
          const fy = faceCy - 5 + pickInt(rng, 12);
          const fr = 0.55 + rng() * 0.35;
          return `<circle cx="${fx}" cy="${fy}" r="${fr.toFixed(2)}" fill="${skinShadow}" opacity="0.42"/>`;
        })
        .join("")
    : "";

  const stubble =
    facialHairType === 0
      ? `<g opacity="0.3">${Array.from({ length: 14 }, () => {
          const sx = 36 + rng() * 28;
          const sy = faceCy + 11 + rng() * 9;
          return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="0.42" fill="${LINE}"/>`;
        }).join("")}</g>`
      : "";
  const goatee =
    facialHairType === 1
      ? `<path d="M46 ${faceCy + 12} Q50 ${faceCy + 20} 54 ${faceCy + 12} Q50 ${faceCy + 16} 46 ${faceCy + 12}" fill="${hair}" opacity="0.7"/>`
      : "";
  const stache =
    facialHairType === 2
      ? `<path d="M42 ${faceCy + 7} Q50 ${faceCy + 10} 58 ${faceCy + 7}" stroke="${hair}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>`
      : "";

  const neck = `<path d="M${50 - faceRx * 0.52} ${faceCy + faceRy - 5} Q50 ${faceCy + faceRy + 6} ${50 + faceRx * 0.52} ${faceCy + faceRy - 5}" fill="${skinShadow}" opacity="0.32"/>`;

  const themeExtras =
    themeId === "celebrities"
      ? `<circle cx="76" cy="22" r="4" fill="${accent}" opacity="0.65"/>`
      : themeId === "government"
        ? `<rect x="44" y="68" width="12" height="4" rx="1" fill="#0f172a" opacity="0.18"/>`
        : `<circle cx="24" cy="24" r="3" fill="${accent}" opacity="0.5"/>`;

  const headwearLate = headwear === "none" ? "" : headwearSvg(headwear, accent, hair, faceCy);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8eef5"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <radialGradient id="${id}-skin" cx="42%" cy="36%" r="70%">
      <stop offset="0%" stop-color="${skinHighlight}"/>
      <stop offset="55%" stop-color="${skin}"/>
      <stop offset="100%" stop-color="${skinShadow}"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="18" fill="url(#${id}-bg)"/>
  ${outfitSvg(outfit, accent)}
  ${hairBackPath(hairStyle, hair, baldTop)}
  ${neck}
  <ellipse cx="50" cy="${faceCy}" rx="${faceRx}" ry="${faceRy}" fill="url(#${id}-skin)"/>
  ${ears}
  ${blushLayer}
  ${freckleLayer}
  ${eyes}
  ${brows}
  ${nose}
  ${mouthLipsSvg(lipStyle, faceCy)}
  ${stubble}
  ${goatee}
  ${stache}
  ${cigarSvg(cigar, faceCy)}
  ${eyewearSvg(eyewear, eyeY, eyeSpread, eyeW, eyeH)}
  ${earringsSvg(earrings, faceCy, faceRx)}
  ${necklaceSvg(necklace, accent, faceCy)}
  ${hairFrontPath(hairStyle, hair, baldTop)}
  ${headwearLate}
  ${themeExtras}
</svg>`;
}

/** Darken or lighten a hex color slightly for shading. */
function adjustColor(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const f = amount >= 0 ? (x: number) => clamp(x + (255 - x) * amount) : (x: number) => clamp(x * (1 + amount));
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
