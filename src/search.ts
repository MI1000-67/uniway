/** Adapted from UniWay search (MIT), © 2026 UniWay contributors.
 * See engine/imported/LICENSE. Shared local search for demo and uploaded maps. */
export type SearchablePlace = {
  name?: string;
  shortName?: string;
  aliases?: readonly string[];
  description?: string;
  category?: string;
  labelNumber?: string;
};

function normalize(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Fold Latin accents without erasing meaningful Tamil/Sinhala vowel marks.
      .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
      .trim()
  );
}

/** At most one edit (including a swapped adjacent pair), in linear time. */
function isNearWord(term: string, word: string): boolean {
  if (!/^[\p{L}\p{M}]+$/u.test(term + word)) return false;
  const a = Array.from(term);
  const b = Array.from(word);
  if ((term.match(/\p{L}/gu)?.length ?? 0) < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length) return b.length - i <= 1;
  if (
    a.length === b.length &&
    a[i] === b[i + 1] &&
    a[i + 1] === b[i] &&
    a.slice(i + 2).join("") === b.slice(i + 2).join("")
  )
    return true;

  const skipA = a.length >= b.length ? 1 : 0;
  const skipB = b.length >= a.length ? 1 : 0;
  return a.slice(i + skipA).join("") === b.slice(i + skipB).join("");
}

function placeScore(place: SearchablePlace, query: string): number | null {
  if (!query) return 0;
  const names = [place.name, place.shortName]
    .filter((value): value is string => !!value)
    .map(normalize);
  const aliases = (place.aliases ?? []).map(normalize);
  if (names.includes(query)) return 0;
  if (aliases.includes(query)) return 1;

  const fields = [
    ...names.map((text) => ({ text, cost: 0, fuzzy: true })),
    ...aliases.map((text) => ({ text, cost: 1, fuzzy: true })),
    ...[place.category, place.labelNumber]
      .filter((value): value is string => !!value)
      .map((text) => ({ text: normalize(text), cost: 8, fuzzy: false })),
    { text: normalize(place.description ?? ""), cost: 10, fuzzy: false },
  ];
  const words = fields.flatMap(({ text, cost, fuzzy }) =>
    text
      .split(" ")
      .filter(Boolean)
      .map((word) => ({ word, cost, fuzzy })),
  );

  let score = 10;
  for (const term of query.split(" ")) {
    let best = Infinity;
    const numeric = /\p{N}/u.test(term);
    for (const { word, cost, fuzzy } of words) {
      if (word === term) best = Math.min(best, cost);
      // Numeric labels are exact: a search for room 1 must not match room 10.
      else if (!numeric && word.startsWith(term))
        best = Math.min(best, cost + 4);
      else if (fuzzy && isNearWord(term, word))
        best = Math.min(best, cost + 20);
    }
    if (!Number.isFinite(best)) return null;
    score += best;
  }
  return score;
}

export function matchesPlace(place: SearchablePlace, query: string): boolean {
  return placeScore(place, normalize(query)) !== null;
}

/** Exact names/aliases precede prefixes and typos; equal scores retain source order. */
export function searchMatchingPlaces<T extends SearchablePlace>(
  places: readonly T[],
  query: string,
): T[] {
  const normalized = normalize(query);
  return places
    .map((place, index) => ({
      place,
      index,
      score: placeScore(place, normalized),
    }))
    .filter(
      (entry): entry is typeof entry & { score: number } =>
        entry.score !== null,
    )
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ place }) => place);
}
