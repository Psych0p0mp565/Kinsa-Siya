import { BOARD_SIZE } from "./constants.js";
import type { ThemeId } from "./types.js";
import { hashStringToSeed, mulberry32, pickInt } from "./rng.js";

/**
 * Public-domain (or federal work) portraits via Wikimedia Commons `Special:FilePath`.
 * Do not replace with random web images — respect copyright and publicity rights.
 *
 * - **government**: mostly U.S. Senate official portraits (typically PD-USGov).
 * - **celebrities**: historic figures / pre-1928-style portrait photos commonly PD on Commons
 *   (not modern red-carpet or rights-managed celebrity shots).
 */

export type PortraitEntry = { displayName: string; commonsFile: string };

/** Stable Commons file names (exact, including punctuation). */
export const GOVERNMENT_OFFICIALS: readonly PortraitEntry[] = [
  { displayName: "Elizabeth Warren", commonsFile: "Elizabeth Warren, official portrait, 114th Congress.jpg" },
  { displayName: "Ted Cruz", commonsFile: "Ted Cruz, official portrait, 113th Congress.jpg" },
  { displayName: "Bernie Sanders", commonsFile: "Bernie Sanders, official portrait, 113th Congress.jpg" },
  { displayName: "Marco Rubio", commonsFile: "Marco Rubio, official portrait, 113th Congress.jpg" },
  { displayName: "Rand Paul", commonsFile: "Rand Paul, official portrait, 113th Congress.jpg" },
  { displayName: "Chuck Schumer", commonsFile: "Chuck Schumer 113th Congress.jpg" },
  { displayName: "Mitch McConnell", commonsFile: "Sen Mitch McConnell official cropped.jpg" },
  { displayName: "Susan Collins", commonsFile: "Susan Collins, official portrait, 113th Congress.jpg" },
  { displayName: "Lisa Murkowski", commonsFile: "Lisa Murkowski, official portrait, 112th Congress.jpg" },
  { displayName: "Jon Tester", commonsFile: "Jon Tester, official portrait, 114th Congress.jpg" },
  { displayName: "Sherrod Brown", commonsFile: "Sherrod Brown, official portrait, 116th Congress.jpg" },
  { displayName: "Amy Klobuchar", commonsFile: "Amy Klobuchar, official portrait, 113th Congress.jpg" },
  { displayName: "Tammy Baldwin", commonsFile: "Tammy Baldwin, official portrait, 113th Congress.jpg" },
  { displayName: "Patty Murray", commonsFile: "Patty Murray, official portrait, 113th Congress.jpg" },
  { displayName: "Ron Wyden", commonsFile: "Ron Wyden, official portrait, 111th Congress.jpg" },
  { displayName: "John Cornyn", commonsFile: "John Cornyn, official portrait, 2009.jpg" },
  { displayName: "Lindsey Graham", commonsFile: "Lindsey Graham, official photo, 113th Congress.jpg" },
  { displayName: "Richard Blumenthal", commonsFile: "Richard Blumenthal, official portrait, 113th Congress.jpg" },
  { displayName: "Cory Booker", commonsFile: "Cory Booker, official portrait, 113th Congress.jpg" },
  { displayName: "Chris Murphy", commonsFile: "Chris Murphy, official portrait, 113th Congress.jpg" },
  { displayName: "Jeanne Shaheen", commonsFile: "Jeanne Shaheen, official portrait, 113th Congress.jpg" },
  { displayName: "Tim Kaine", commonsFile: "Tim Kaine, official portrait, 113th Congress.jpg" },
  { displayName: "Mark Warner", commonsFile: "Mark Warner, official portrait, 112th Congress.jpg" },
  { displayName: "Dick Durbin", commonsFile: "Dick Durbin, official portrait, 115th Congress.jpg" },
] as const;

/** Historic / PD-style “household name” portraits — not contemporary paparazzi imagery. */
export const CELEBRITY_FACES: readonly PortraitEntry[] = [
  { displayName: "Mark Twain", commonsFile: "Mark Twain by AF Bradley.jpg" },
  { displayName: "Oscar Wilde", commonsFile: "Oscar Wilde by Napoleon Sarony.jpg" },
  { displayName: "Charles Dickens", commonsFile: "Dickens Gurney head.jpg" },
  { displayName: "Walt Whitman", commonsFile: "Walt Whitman - George Collins Cox.jpg" },
  { displayName: "William Shakespeare", commonsFile: "William Shakespeare by John Taylor, edited.jpg" },
  { displayName: "Abraham Lincoln", commonsFile: "Abraham Lincoln O-77 matte collodion print.jpg" },
  { displayName: "Frederick Douglass", commonsFile: "Frederick Douglass (circa 1879).jpg" },
  { displayName: "Susan B. Anthony", commonsFile: "Susan B. Anthony c1855.png" },
  { displayName: "Florence Nightingale", commonsFile: "Florence Nightingale CDV by H Lenth.jpg" },
  { displayName: "Harriet Beecher Stowe", commonsFile: "Harriet Beecher Stowe c1852.jpg" },
  { displayName: "Edgar Allan Poe", commonsFile: "Edgar Allan Poe 2 retouched opaque.png" },
  { displayName: "Louisa May Alcott", commonsFile: "Louisa May Alcott, c. 1870 (cropped).jpg" },
  { displayName: "Ralph Waldo Emerson", commonsFile: "Ralph Waldo Emerson ca1857 retouched.jpg" },
  { displayName: "Emily Dickinson", commonsFile: "Emily Dickinson daguerreotype (Restored).jpg" },
  { displayName: "Clara Barton", commonsFile: "Clara Barton.jpg" },
  { displayName: "Sojourner Truth", commonsFile: "Sojourner Truth c1864.jpg" },
  { displayName: "Ulysses S. Grant", commonsFile: "Ulysses S Grant by Brady c1870-restored.jpg" },
  { displayName: "Robert Louis Stevenson", commonsFile: "Robert Louis Stevenson.jpg" },
  { displayName: "Thomas Edison", commonsFile: "Thomas Edison2.jpg" },
  { displayName: "Charlie Chaplin", commonsFile: "Charlie Chaplin portrait.jpg" },
  { displayName: "Victor Hugo", commonsFile: "Victor Hugo by Étienne Carjat 1876 - full.jpg" },
  { displayName: "Johannes Brahms", commonsFile: "JohannesBrahms1853.jpg" },
  { displayName: "Pyotr Ilyich Tchaikovsky", commonsFile: "Tchaikovsky 1876.jpg" },
  { displayName: "Claude Monet", commonsFile: "Claude Monet 1899 Nadar.jpg" },
  { displayName: "Marie Curie", commonsFile: "Marie Curie c1920.jpg" },
  { displayName: "Nikola Tesla", commonsFile: "Nikola Tesla, c.1896.jpg" },
  { displayName: "Albert Einstein", commonsFile: "Albert Einstein Head.jpg" },
  { displayName: "George Washington", commonsFile: "Gilbert Stuart Williamstown Portrait of George Washington.jpg" },
  { displayName: "Winston Churchill", commonsFile: "Churchill HU 90973.jpg" },
  { displayName: "Jane Austen", commonsFile: "Jane Austen, from A Memoir of Jane Austen (1870).jpg" },
  { displayName: "Lewis Carroll", commonsFile: "LewisCarrollSelfPhoto.jpg" },
  { displayName: "Galileo Galilei", commonsFile: "Justus Sustermans - Portrait of Galileo Galilei, 1636.jpg" },
  { displayName: "Isaac Newton", commonsFile: "GodfreyKneller-IsaacNewton-1689.jpg" },
  { displayName: "Helen Keller", commonsFile: "Helen Keller.jpg" },
  { displayName: "Sigmund Freud", commonsFile: "Sigmund Freud, by Max Halberstadt (cropped).jpg" },
] as const;

if (GOVERNMENT_OFFICIALS.length !== BOARD_SIZE) {
  throw new Error("portraitCatalog: government pack must have BOARD_SIZE entries");
}
if (CELEBRITY_FACES.length < BOARD_SIZE) {
  throw new Error("portraitCatalog: celebrity pool must have at least BOARD_SIZE entries");
}

/** Each match uses BOARD_SIZE portraits; when the pool is larger, pick a deterministic subset per rosterSeed. */
const celebrityPackCache = new Map<string, readonly PortraitEntry[]>();

function resolvedCelebrityPack(rosterSeed: string): readonly PortraitEntry[] {
  const hit = celebrityPackCache.get(rosterSeed);
  if (hit) return hit;

  if (CELEBRITY_FACES.length === BOARD_SIZE) {
    celebrityPackCache.set(rosterSeed, CELEBRITY_FACES);
    return CELEBRITY_FACES;
  }

  const rng = mulberry32(hashStringToSeed(`${rosterSeed}|celebritySubset`));
  const n = CELEBRITY_FACES.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < BOARD_SIZE; i++) {
    const j = i + pickInt(rng, n - i);
    const a = idx[i]!;
    const b = idx[j]!;
    idx[i] = b;
    idx[j] = a;
  }
  const picked = idx.slice(0, BOARD_SIZE).map((i) => CELEBRITY_FACES[i]!);
  celebrityPackCache.set(rosterSeed, picked);
  if (celebrityPackCache.size > 400) celebrityPackCache.clear();
  return picked;
}

export function wikimediaCommonsPortraitUrl(commonsFile: string, width = 360): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsFile)}?width=${width}`;
}

/** Deterministic shuffle: same rosterSeed + theme ⇒ same slot ordering. */
function slotToPortraitIndex(rosterSeed: string, themeId: ThemeId, slotIndex: number): number {
  const order = Array.from({ length: BOARD_SIZE }, (_, i) => i);
  const rng = mulberry32(hashStringToSeed(`${rosterSeed}|portraitPerm|${themeId}`));
  for (let i = BOARD_SIZE - 1; i > 0; i--) {
    const j = pickInt(rng, i + 1);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order[slotIndex]!;
}

export function portraitForCharacter(
  themeId: ThemeId,
  rosterSeed: string,
  slotIndex: number,
): { displayName: string; portraitUrl: string } | null {
  const pack =
    themeId === "government"
      ? GOVERNMENT_OFFICIALS
      : themeId === "celebrities"
        ? resolvedCelebrityPack(rosterSeed)
        : null;
  if (!pack) return null;
  const pi = slotToPortraitIndex(rosterSeed, themeId, slotIndex);
  const entry = pack[pi]!;
  return {
    displayName: entry.displayName,
    portraitUrl: wikimediaCommonsPortraitUrl(entry.commonsFile),
  };
}
