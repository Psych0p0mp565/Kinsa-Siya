import type { ThemeId } from "./types.js";
import { mulberry32, pickInt } from "./rng.js";

const SKIN = ["#c68642", "#a45c32", "#e0ac69", "#8d5524", "#f3d4c3", "#5c3d2e"];
const HAIR = ["#1a1a1a", "#3d2314", "#2c1810", "#6b4423", "#0f172a", "#fde68a", "#7c3aed"];
const ACC_CELEB = ["#f472b6", "#fbbf24", "#38bdf8", "#a78bfa"];
const ACC_GOV = ["#1e3a5f", "#334155", "#0f766e", "#78350f"];
const ACC_TOON = ["#22c55e", "#f97316", "#ec4899", "#06b6d4"];

function themeAccents(themeId: ThemeId): string[] {
  if (themeId === "celebrities") return ACC_CELEB;
  if (themeId === "government") return ACC_GOV;
  return ACC_TOON;
}

/** Returns an SVG string for a square avatar viewBox 0 0 100 100 */
export function avatarSvg(seed: number, themeId: ThemeId): string {
  const rng = mulberry32(seed);
  const skin = SKIN[pickInt(rng, SKIN.length)]!;
  const hair = HAIR[pickInt(rng, HAIR.length)]!;
  const accents = themeAccents(themeId);
  const accent = accents[pickInt(rng, accents.length)]!;
  const eyeY = 44 + pickInt(rng, 5);
  const mouth = rng() > 0.5 ? "curve" : "smile";
  const hairStyle = pickInt(rng, 3); // 0 short, 1 medium, 2 tall cartoon

  const hairPath =
    hairStyle === 0
      ? `<path d="M22 48 Q50 18 78 48 L78 40 Q50 12 22 40 Z" fill="${hair}"/>`
      : hairStyle === 1
        ? `<path d="M18 52 Q50 10 82 52 L82 38 Q50 8 18 38 Z" fill="${hair}"/>`
        : `<path d="M14 58 Q50 -2 86 58 L86 42 Q50 0 14 42 Z" fill="${hair}"/>`;

  const celebExtras =
    themeId === "celebrities"
      ? `<circle cx="72" cy="28" r="6" fill="${accent}" opacity="0.9"/>
         <rect x="26" y="22" width="22" height="6" rx="2" fill="#111827" opacity="0.35"/>`
      : "";
  const govExtras =
    themeId === "government"
      ? `<path d="M30 78 L70 78 L66 88 L34 88 Z" fill="${accent}" opacity="0.85"/>
         <rect x="38" y="70" width="24" height="6" rx="1" fill="#0f172a" opacity="0.25"/>`
      : "";
  const toonExtras =
    themeId === "cartoons"
      ? `<ellipse cx="50" cy="88" rx="18" ry="6" fill="${accent}" opacity="0.5"/>
         <circle cx="28" cy="40" r="7" fill="#fff" stroke="#111827" stroke-width="2"/>
         <circle cx="72" cy="40" r="7" fill="#fff" stroke="#111827" stroke-width="2"/>`
      : "";

  const eyes =
    themeId === "cartoons"
      ? `<ellipse cx="36" cy="${eyeY}" rx="9" ry="12" fill="#111827"/>
         <ellipse cx="64" cy="${eyeY}" rx="9" ry="12" fill="#111827"/>
         <circle cx="38" cy="${eyeY - 2}" r="3" fill="#fff"/>
         <circle cx="66" cy="${eyeY - 2}" r="3" fill="#fff"/>`
      : `<ellipse cx="36" cy="${eyeY}" rx="5" ry="7" fill="#111827"/>
         <ellipse cx="64" cy="${eyeY}" rx="5" ry="7" fill="#111827"/>
         <circle cx="37" cy="${eyeY - 2}" r="2" fill="#fff"/>
         <circle cx="65" cy="${eyeY - 2}" r="2" fill="#fff"/>`;

  const mouthPath =
    mouth === "curve"
      ? `<path d="M40 62 Q50 70 60 62" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M42 62 Q50 68 58 62" stroke="#111827" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="g${seed}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="16" fill="url(#g${seed})"/>
  ${hairPath}
  <ellipse cx="50" cy="54" rx="28" ry="30" fill="${skin}"/>
  ${eyes}
  ${mouthPath}
  ${celebExtras}
  ${govExtras}
  ${toonExtras}
</svg>`;
}
