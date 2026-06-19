export interface LabelGroup {
  name: string;
  count: number;
  tileIds: string[];
}

export function groupTilesByLabel(tiles: { id: string; labels: string[] }[]): LabelGroup[] {
  const map = new Map<string, LabelGroup>();
  for (const t of tiles) {
    for (const label of t.labels) {
      const g = map.get(label) ?? { name: label, count: 0, tileIds: [] };
      g.count += 1;
      g.tileIds.push(t.id);
      map.set(label, g);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
