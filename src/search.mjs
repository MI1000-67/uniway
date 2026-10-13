const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function closeWord(a, b) {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length] <= 1;
}
export function matchesPlace(place, query) {
  const q = normalize(query);
  if (!q) return true;
  const text = normalize([place.name, place.description, ...(place.aliases ?? [])].join(' '));
  if (text.includes(q)) return true;
  const words = text.split(' ');
  return q
    .split(' ')
    .every((term) => words.some((word) => word.startsWith(term) || closeWord(term, word)));
}
