import { edges, nodes } from "./campus";
import type { PathEdge, PathNode } from "./campus";

export type PathAlternative = {
  points: PathNode[];
  distancePixels: number;
};

type Neighbor = { id: string; distance: number };
type Candidate = { ids: string[]; distance: number };

const edgeKey = (from: string, to: string) =>
  JSON.stringify(from < to ? [from, to] : [to, from]);

/** A small min-heap keeps spur searches efficient on traced path networks. */
class Frontier {
  private entries: Neighbor[] = [];
  private before(a: Neighbor, b: Neighbor) {
    return (
      a.distance < b.distance || (a.distance === b.distance && a.id < b.id)
    );
  }
  push(entry: Neighbor) {
    this.entries.push(entry);
    let child = this.entries.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (!this.before(this.entries[child], this.entries[parent])) break;
      [this.entries[child], this.entries[parent]] = [
        this.entries[parent],
        this.entries[child],
      ];
      child = parent;
    }
  }
  pop(): Neighbor | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || !this.entries.length) return first;
    this.entries[0] = last;
    let parent = 0;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let next = parent;
      if (
        left < this.entries.length &&
        this.before(this.entries[left], this.entries[next])
      )
        next = left;
      if (
        right < this.entries.length &&
        this.before(this.entries[right], this.entries[next])
      )
        next = right;
      if (next === parent) break;
      [this.entries[parent], this.entries[next]] = [
        this.entries[next],
        this.entries[parent],
      ];
      parent = next;
    }
    return first;
  }
}

function shortestPath(
  start: string,
  end: string,
  adjacency: Map<string, Neighbor[]>,
  blockedNodes = new Set<string>(),
  blockedEdges = new Set<string>(),
): Candidate | null {
  if (blockedNodes.has(start) || blockedNodes.has(end)) return null;
  const distances = new Map([[start, 0]]);
  const previous = new Map<string, string>();
  const settled = new Set<string>();
  const frontier = new Frontier();
  frontier.push({ id: start, distance: 0 });
  let current: Neighbor | undefined;
  while ((current = frontier.pop())) {
    if (settled.has(current.id)) continue;
    settled.add(current.id);
    if (current.id === end) {
      const ids = [end];
      while (ids[0] !== start) ids.unshift(previous.get(ids[0])!);
      return { ids, distance: current.distance };
    }
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (
        settled.has(neighbor.id) ||
        blockedNodes.has(neighbor.id) ||
        blockedEdges.has(edgeKey(current.id, neighbor.id))
      )
        continue;
      const distance = current.distance + neighbor.distance;
      if (distance < (distances.get(neighbor.id) ?? Infinity)) {
        distances.set(neighbor.id, distance);
        previous.set(neighbor.id, current.id);
        frontier.push({ id: neighbor.id, distance });
      }
    }
  }
  return null;
}

/**
 * Yen's k-shortest simple paths, capped at the three choices shown by Uniway.
 * Each candidate uses actual graph edges, never repeats a node, and is ranked
 * by drawn path length. No physical distance or accessibility is inferred.
 */
export function findRouteAlternatives(
  start: string,
  end: string,
  stepFree: boolean,
  graphNodes: PathNode[] = nodes,
  graphEdges: PathEdge[] = edges,
  limit = 3,
): PathAlternative[] {
  const count = Math.max(
    0,
    Math.min(3, Number.isFinite(limit) ? Math.floor(limit) : 3),
  );
  if (!count) return [];
  const lookup = new Map(
    graphNodes
      .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
      .map((node) => [node.id, node]),
  );
  if (!lookup.has(start) || !lookup.has(end)) return [];
  const adjacency = new Map<string, Neighbor[]>(
    [...lookup.keys()].map((id) => [id, []]),
  );
  const includedEdges = new Set<string>();
  for (const edge of graphEdges) {
    if ((stepFree && !edge.stepFree) || edge.from === edge.to) continue;
    const from = lookup.get(edge.from),
      to = lookup.get(edge.to);
    if (!from || !to) continue;
    const key = edgeKey(from.id, to.id);
    if (includedEdges.has(key)) continue;
    const distance = Math.hypot(from.x - to.x, from.y - to.y);
    if (!Number.isFinite(distance)) continue;
    includedEdges.add(key);
    adjacency.get(from.id)!.push({ id: to.id, distance });
    adjacency.get(to.id)!.push({ id: from.id, distance });
  }
  const shortest = shortestPath(start, end, adjacency);
  if (!shortest) return [];
  const accepted = [shortest];
  const candidates = new Map<string, Candidate>();
  const known = new Set([JSON.stringify(shortest.ids)]);
  while (accepted.length < count) {
    const last = accepted[accepted.length - 1];
    let rootDistance = 0;
    for (let spurIndex = 0; spurIndex < last.ids.length - 1; spurIndex++) {
      const root = last.ids.slice(0, spurIndex + 1);
      const blockedEdges = new Set<string>();
      for (const path of accepted) {
        if (
          path.ids.length > spurIndex + 1 &&
          root.every((id, index) => path.ids[index] === id)
        ) {
          blockedEdges.add(
            edgeKey(path.ids[spurIndex], path.ids[spurIndex + 1]),
          );
        }
      }
      const spur = shortestPath(
        root[root.length - 1],
        end,
        adjacency,
        new Set(root.slice(0, -1)),
        blockedEdges,
      );
      if (spur) {
        const ids = [...root.slice(0, -1), ...spur.ids];
        const key = JSON.stringify(ids);
        if (!known.has(key)) {
          known.add(key);
          candidates.set(key, { ids, distance: rootDistance + spur.distance });
        }
      }
      const a = lookup.get(last.ids[spurIndex])!,
        b = lookup.get(last.ids[spurIndex + 1])!;
      rootDistance += Math.hypot(a.x - b.x, a.y - b.y);
    }
    const next = [...candidates.entries()].sort(
      ([keyA, a], [keyB, b]) =>
        a.distance - b.distance || keyA.localeCompare(keyB),
    )[0];
    if (!next) break;
    accepted.push(next[1]);
    candidates.delete(next[0]);
  }
  return accepted.map((path) => ({
    points: path.ids.map((id) => lookup.get(id)!),
    distancePixels: path.distance,
  }));
}
