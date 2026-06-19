import type { SemanticRole, Tile } from "../domain/tile";

type QueryResult<T> = Promise<{
  data: T[] | null;
  error: { message: string } | null;
}>;
type QueryBuilder<T> = {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: string): QueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T>;
};
type StorageClient = {
  from(table: string): {
    upsert(
      rows: unknown[],
      options: { onConflict: string },
    ): Promise<{ error: { message: string } | null }>;
    select(columns: string): QueryBuilder<TileRow>;
  };
};

interface TileRow {
  tile_id: string;
  title: string;
  semantic_role: string;
  tile_json: unknown;
  closed_at: string | null;
}

export class EventStore {
  constructor(
    private client: StorageClient,
    private userId: string,
  ) {}

  async replaceAllTiles(tiles: Tile[]): Promise<void> {
    if (tiles.length === 0) return;
    const rows = tiles.map((tile) => {
      const normalized = normalizeTileForStorage(tile);
      return {
        tile_id: tile.core.id,
        user_id: this.userId,
        title: tile.core.title,
        semantic_role: normalized.annotation.semanticRole,
        tile_json: serializeTile(normalized),
        closed_at: getTileClosedAt(normalized),
      };
    });

    const { error } = await this.client.from("tiles").upsert(rows, { onConflict: "tile_id" });

    if (error) {
      throw new Error(`Failed to upsert tiles: ${error.message}`);
    }
  }

  async loadAllTiles(): Promise<Tile[]> {
    const { data, error } = await this.client
      .from("tiles")
      .select("tile_id,title,semantic_role,tile_json,closed_at")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load tiles: ${error.message}`);
    }

    return (data || []).map((row: TileRow) => deserializeTile(row.tile_json, row.semantic_role));
  }
}

function serializeTile(tile: Tile): unknown {
  return JSON.parse(JSON.stringify(tile));
}

function deserializeTile(raw: unknown, semanticRoleFromRow?: string): Tile {
  const tile = structuredClone(raw) as Tile;
  const annotation = tile.annotation as unknown as Record<string, unknown> | undefined;
  const semanticRoleRaw =
    (typeof annotation?.semanticRole === "string" ? annotation.semanticRole : null) ??
    (typeof annotation?.semantic_role === "string" ? annotation.semantic_role : null) ??
    (typeof semanticRoleFromRow === "string" ? semanticRoleFromRow : null);
  tile.annotation.semanticRole = normalizeSemanticRole(semanticRoleRaw);
  if (tile?.core?.startedAt) tile.core.startedAt = toValidDateOrNull(tile.core.startedAt);
  if (tile?.core?.completedAt) tile.core.completedAt = toValidDateOrNull(tile.core.completedAt);
  if (tile?.temporal?.releaseAt)
    tile.temporal.releaseAt = toValidDateOrNull(tile.temporal.releaseAt);
  if (tile?.temporal?.dueAt) tile.temporal.dueAt = toValidDateOrNull(tile.temporal.dueAt);
  if (tile?.temporal?.fixedStart)
    tile.temporal.fixedStart = toValidDateOrNull(tile.temporal.fixedStart);
  if (tile?.temporal?.fixedEnd) tile.temporal.fixedEnd = toValidDateOrNull(tile.temporal.fixedEnd);
  if (tile?.temporal?.activeStart)
    tile.temporal.activeStart = toValidDateOrNull(tile.temporal.activeStart);
  if (tile?.temporal?.activeEnd)
    tile.temporal.activeEnd = toValidDateOrNull(tile.temporal.activeEnd);
  if (Array.isArray(tile?.work?.segments)) {
    const normalizedSegments: typeof tile.work.segments = [];
    for (const segment of tile.work.segments) {
      const startAt = toValidDateOrNull(segment.startAt);
      if (!startAt) continue;
      normalizedSegments.push({
        ...segment,
        startAt,
        endAt: segment.endAt ? toValidDateOrNull(segment.endAt) : null,
        expectedEndAt:
          segment.expectedEndAt === undefined
            ? undefined
            : segment.expectedEndAt
              ? toValidDateOrNull(segment.expectedEndAt)
              : null,
      });
    }
    tile.work.segments = normalizedSegments;
  }
  if (Array.isArray(tile?.annotation?.timedLabels)) {
    tile.annotation.timedLabels = tile.annotation.timedLabels.map((label) => ({
      ...label,
      startAt: label.startAt ? toValidDateOrNull(label.startAt) : null,
      endAt: label.endAt ? toValidDateOrNull(label.endAt) : null,
    }));
  }
  return tile;
}

function getTileClosedAt(tile: Tile): string | null {
  const segments = tile.work?.segments ?? [];
  if (segments.length === 0) return null;
  const latestClosed = segments
    .map((segment) => segment.endAt)
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];
  return latestClosed ? latestClosed.toISOString() : null;
}

function toValidDateOrNull(value: unknown): Date | null {
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTileForStorage(tile: Tile): Tile {
  const normalized = structuredClone(tile) as Tile;
  const annotation = normalized.annotation as unknown as Record<string, unknown>;
  const semanticRoleRaw =
    (typeof annotation.semanticRole === "string" ? annotation.semanticRole : null) ??
    (typeof annotation.semantic_role === "string" ? annotation.semantic_role : null);
  normalized.annotation.semanticRole = normalizeSemanticRole(semanticRoleRaw);
  return normalized;
}

function normalizeSemanticRole(value: string | null): SemanticRole {
  if (value === "break" || value === "label") return value;
  return "work";
}
