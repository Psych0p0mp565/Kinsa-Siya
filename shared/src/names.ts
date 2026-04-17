import type { ThemeId } from "./types.js";
import { mulberry32, pickInt } from "./rng.js";

const GIVEN = [
  "Miguel",
  "Sofia",
  "Andres",
  "Luningning",
  "Jose",
  "Rosa",
  "Paolo",
  "Dalisay",
  "Rico",
  "Marikit",
  "Benjie",
  "Tala",
  "Carlo",
  "Iska",
  "Dante",
  "Liwayway",
  "Nico",
  "Bituin",
  "Kiko",
  "Alon",
  "Mando",
  "Sinta",
];

const NICK = [
  "Totoy",
  "Inday",
  "Bunso",
  "Ate",
  "Kuya",
  "Tito",
  "Tita",
  "Boss",
  "Idol",
  "Star",
  "Chief",
  "Kap",
];

const CELEB_SUFFIX = [
  "ng Maynila",
  "Live!",
  "Sa Gabi",
  "Unplugged",
  "The Tour",
  "VIP",
  "Encore",
  "Spotlight",
];

const GOV_SUFFIX = [
  "Hall",
  "Desk",
  "Office",
  "District",
  "Council",
  "Desk Hours",
  "Public Info",
  "Services",
];

const TOON_SUFFIX = [
  "Adventures",
  "Zap!",
  "Turbo",
  "Mega",
  "Mini",
  "Toons",
  "Funny",
  "Chibi",
];

export function composeDisplayName(themeId: ThemeId, seed: number): string {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const first = GIVEN[pickInt(rng, GIVEN.length)]!;
  const useNick = rng() > 0.55;
  const nick = NICK[pickInt(rng, NICK.length)]!;
  const suffixList =
    themeId === "celebrities"
      ? CELEB_SUFFIX
      : themeId === "government"
        ? GOV_SUFFIX
        : TOON_SUFFIX;
  const suf = suffixList[pickInt(rng, suffixList.length)]!;
  if (useNick) {
    return `${nick} ${first} ${suf}`;
  }
  return `${first} ${suf}`;
}
