import type { ThemeId } from "./types.js";
import { mulberry32, pickInt } from "./rng.js";

/** Skin tones — warm, slightly desaturated for a cohesive “toon cast” look. */
const SKIN = ["#c58b5e", "#a56c44", "#e8b892", "#7d4e32", "#f5d5c4", "#5c4033", "#edb98e", "#9e6542", "#d4a574"];
const HAIR = ["#0f0f10", "#2a1810", "#4a3728", "#6b5344", "#1e293b", "#f5e6c8", "#5b21b6", "#b45309", "#14532d", "#7c2d12"];
const EYE_IRIS = ["#3d2b1f", "#5c4033", "#2563eb", "#0d9488", "#4b5563", "#1e40af", "#6b21a8"];
const ACC_CELEB = ["#f472b6", "#fbbf24", "#38bdf8", "#a78bfa"];
const ACC_GOV = ["#1e3a5f", "#334155", "#0f766e", "#78350f"];
const ACC_TOON = ["#22c55e", "#f97316", "#ec4899", "#06b6d4"];

const LINE = "#1e293b";
const LINE_SOFT = "rgba(30,41,59,0.55)";

function themeAccents(themeId: ThemeId): string[] {
  if (themeId === "celebrities") return ACC_CELEB;
  if (themeId === "government") return ACC_GOV;
  return ACC_TOON;
}

function hairBackPath(style: number, hair: string): string {
  switch (style) {
    case 0:
      return `<path d="M14 46 Q50 6 86 46 L86 34 Q50 2 14 34 Z" fill="${hair}"/>`;
    case 1:
      return `<path d="M12 50 Q50 4 88 50 L88 32 Q50 0 12 32 Z" fill="${hair}"/>`;
    case 2:
      return `<path d="M10 54 Q50 -4 90 54 L90 38 Q50 4 10 38 Z" fill="${hair}"/>`;
    case 3:
      return `<path d="M18 48 Q50 12 82 48 L82 28 Q50 8 18 28 Q24 20 50 14 Q76 20 82 28 Z" fill="${hair}"/>`;
    case 4:
      return `<path d="M16 52 Q50 8 84 52 L84 30 Q50 6 16 30 Q50 18 84 30 Z" fill="${hair}"/>`;
    default:
      return `<path d="M20 50 Q50 10 80 50 L78 36 Q50 14 22 36 Z" fill="${hair}"/>`;
  }
}

function hairFrontPath(style: number, hair: string): string {
  switch (style) {
    case 0:
      return `<path d="M24 42 Q50 36 76 42 Q74 48 50 46 Q26 48 24 42 Z" fill="${hair}" opacity="0.95"/>`;
    case 1:
      return `<path d="M22 40 L50 34 L78 40 L76 46 Q50 44 24 46 Z" fill="${hair}" opacity="0.92"/>`;
    case 2:
      return `<path d="M28 38 Q50 30 72 38 Q70 46 50 42 Q30 46 28 38 Z" fill="${hair}" opacity="0.9"/>`;
    case 3:
      return `<path d="M26 44 Q50 38 74 44 L72 50 Q50 47 28 50 Z" fill="${hair}" opacity="0.88"/>`;
    case 4:
      return ""; // slick back — no bangs
    default:
      return `<path d="M26 41 Q50 35 74 41 Q72 47 50 45 Q28 47 26 41 Z" fill="${hair}" opacity="0.9"/>`;
  }
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

  const hairStyle = pickInt(rng, 6);
  const faceRx = 23 + pickInt(rng, 8);
  const faceRy = 25 + pickInt(rng, 8);
  const faceCy = 52 + pickInt(rng, 5);
  const eyeY = faceCy - 8 + pickInt(rng, 5);
  const eyeSpread = 11 + pickInt(rng, 6);
  const eyeW = 4 + pickInt(rng, 3);
  const eyeH = 5 + pickInt(rng, 3);
  const pupilR = 1.6 + rng() * 0.9;
  const browLift = pickInt(rng, 4);
  const mouthKind = pickInt(rng, 4);
  const glasses = rng() > 0.62;
  const freckles = rng() > 0.72;
  const blush = rng() > 0.45;
  /** Rare — keeps silhouettes readable without “spot the beard” gameplay. */
  const facialHairType = rng() > 0.84 ? pickInt(rng, 3) : -1; // -1 none, 0 stubble, 1 goatee, 2 stache

  const earH = 7 + pickInt(rng, 4);
  const earW = 3 + pickInt(rng, 2);
  const earY = faceCy - 2;

  const id = `av-${(seed >>> 0).toString(16)}`;

  const mouthPath = (() => {
    const cy = faceCy + 10 + pickInt(rng, 3);
    switch (mouthKind) {
      case 0:
        return `<path d="M40 ${cy} Q50 ${cy + 6} 60 ${cy}" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 1:
        return `<path d="M41 ${cy} Q50 ${cy + 7} 59 ${cy}" stroke="${LINE}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      case 2:
        return `<path d="M44 ${cy} Q50 ${cy + 4} 56 ${cy}" stroke="${LINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
      default:
        return `<path d="M42 ${cy} Q50 ${cy + 5} 58 ${cy}" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    }
  })();

  const brows = (() => {
    const y = eyeY - 7 - browLift;
    const tilt = pickInt(rng, 5) - 2;
    return `<path d="M${50 - eyeSpread - 8} ${y + tilt} Q${50 - eyeSpread} ${y - 2} ${50 - eyeSpread + 8} ${y}" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M${50 + eyeSpread - 8} ${y} Q${50 + eyeSpread} ${y - 2} ${50 + eyeSpread + 8} ${y + tilt}" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  })();

  const nose = `<path d="M50 ${eyeY + 4} Q48 ${faceCy + 2} 50 ${faceCy + 4}" stroke="${LINE_SOFT}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;

  const eyes = `<ellipse cx="${50 - eyeSpread}" cy="${eyeY}" rx="${eyeW + 2}" ry="${eyeH + 2}" fill="#fff"/>
    <ellipse cx="${50 + eyeSpread}" cy="${eyeY}" rx="${eyeW + 2}" ry="${eyeH + 2}" fill="#fff"/>
    <ellipse cx="${50 - eyeSpread}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="${iris}"/>
    <ellipse cx="${50 + eyeSpread}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="${iris}"/>
    <circle cx="${50 - eyeSpread + 1}" cy="${eyeY - 1}" r="${pupilR.toFixed(2)}" fill="#0f172a"/>
    <circle cx="${50 + eyeSpread + 1}" cy="${eyeY - 1}" r="${pupilR.toFixed(2)}" fill="#0f172a"/>
    <circle cx="${50 - eyeSpread - 0.5}" cy="${eyeY - 2}" r="1.1" fill="#fff" opacity="0.85"/>
    <circle cx="${50 + eyeSpread - 0.5}" cy="${eyeY - 2}" r="1.1" fill="#fff" opacity="0.85"/>`;

  const ears = `<ellipse cx="${50 - faceRx - earW * 0.3}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skin}" stroke="${LINE_SOFT}" stroke-width="0.8"/>
    <ellipse cx="${50 + faceRx + earW * 0.3}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skin}" stroke="${LINE_SOFT}" stroke-width="0.8"/>`;

  const blushLayer = blush
    ? `<ellipse cx="${50 - faceRx * 0.45}" cy="${faceCy + 2}" rx="8" ry="5" fill="#f472b6" opacity="0.12"/>
       <ellipse cx="${50 + faceRx * 0.45}" cy="${faceCy + 2}" rx="8" ry="5" fill="#f472b6" opacity="0.12"/>`
    : "";

  const freckleLayer = freckles
    ? [0, 1, 2, 3, 4]
        .map((i) => {
          const fx = 42 + pickInt(rng, 18);
          const fy = faceCy - 4 + pickInt(rng, 12);
          const fr = 0.6 + rng() * 0.35;
          return `<circle cx="${fx}" cy="${fy}" r="${fr.toFixed(2)}" fill="${skinShadow}" opacity="0.45"/>`;
        })
        .join("")
    : "";

  const stubble =
    facialHairType === 0
      ? `<g opacity="0.32">${Array.from({ length: 16 }, () => {
          const sx = 36 + rng() * 28;
          const sy = faceCy + 12 + rng() * 10;
          return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="0.45" fill="${LINE}"/>`;
        }).join("")}</g>`
      : "";
  const goatee =
    facialHairType === 1
      ? `<path d="M46 ${faceCy + 14} Q50 ${faceCy + 22} 54 ${faceCy + 14} Q50 ${faceCy + 18} 46 ${faceCy + 14}" fill="${hair}" opacity="0.72"/>`
      : "";
  const stache =
    facialHairType === 2
      ? `<path d="M42 ${faceCy + 8} Q50 ${faceCy + 11} 58 ${faceCy + 8}" stroke="${hair}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.82"/>`
      : "";

  const glassesLayer = glasses
    ? (() => {
        const lx = 50 - eyeSpread - eyeW - 5;
        const rx = 50 + eyeSpread - eyeW - 5;
        const gw = eyeW * 2 + 10;
        const gh = eyeH * 2 + 7;
        const gy = eyeY - eyeH - 3;
        const bridgeY = eyeY;
        const leftOuter = lx + gw;
        const rightInner = rx;
        return `<g fill="none" stroke="${LINE}" stroke-width="1.35" opacity="0.88">
        <rect x="${lx}" y="${gy}" width="${gw}" height="${gh}" rx="3"/>
        <rect x="${rx}" y="${gy}" width="${gw}" height="${gh}" rx="3"/>
        <line x1="${leftOuter}" y1="${bridgeY}" x2="${rightInner}" y2="${bridgeY}" stroke-width="1.2"/>
      </g>`;
      })()
    : "";

  const neck = `<path d="M${50 - faceRx * 0.55} ${faceCy + faceRy - 4} Q50 ${faceCy + faceRy + 10} ${50 + faceRx * 0.55} ${faceCy + faceRy - 4}" fill="${skinShadow}" opacity="0.35"/>`;

  const themeExtras =
    themeId === "celebrities"
      ? `<circle cx="74" cy="26" r="5" fill="${accent}" opacity="0.75"/>
         <path d="M28 24 L48 24 L46 28 L30 28 Z" fill="#111827" opacity="0.22"/>`
      : themeId === "government"
        ? `<path d="M32 80 L68 80 L64 92 L36 92 Z" fill="${accent}" opacity="0.8"/>
           <rect x="40" y="74" width="20" height="5" rx="1" fill="#0f172a" opacity="0.2"/>`
        : `<ellipse cx="50" cy="92" rx="16" ry="5" fill="${accent}" opacity="0.35"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <radialGradient id="${id}-skin" cx="42%" cy="38%" r="68%">
      <stop offset="0%" stop-color="${skinHighlight}"/>
      <stop offset="55%" stop-color="${skin}"/>
      <stop offset="100%" stop-color="${skinShadow}"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="18" fill="url(#${id}-bg)"/>
  ${hairBackPath(hairStyle, hair)}
  ${neck}
  <ellipse cx="50" cy="${faceCy}" rx="${faceRx}" ry="${faceRy}" fill="url(#${id}-skin)"/>
  ${ears}
  ${blushLayer}
  ${freckleLayer}
  ${eyes}
  ${brows}
  ${nose}
  ${mouthPath}
  ${stubble}
  ${goatee}
  ${stache}
  ${glassesLayer}
  ${hairFrontPath(hairStyle, hair)}
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
