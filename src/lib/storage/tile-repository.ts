import { createTileId } from "../domain/ids";
import type { Tile, TileCore } from "../domain/tile";

type TileRow = {
  local_tile_id: string;
  title: string;
  next_action: string | null;
  done_definition: string | null;
  tz?: string | null;
};

type QueryResult<T> = Promise<{
  data: T[] | null;
  error: { message: string } | null;
}>;
type QueryBuilder<T> = {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: string): QueryBuilder<T>;
  is(column: string, value: null): QueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryResult<T>;
};
type TileStorageClient = {
  from(table: string): QueryBuilder<TileRow>;
};

export class TileRepository {
  constructor(private client: TileStorageClient) {}

  async listTiles(userId: string): Promise<Tile[]> {
    const { data, error } = await this.client
      .from("tiles")
      .select("id, local_tile_id, title, next_action, done_definition, tz")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load tiles: ${error.message}`);
    }

    return (data || []).map((row) => this.deserialize(row));
  }

  private deserialize(row: TileRow): Tile {
    const core: TileCore = {
      id: createTileId(row.local_tile_id),
      title: row.title,
      nextAction: row.next_action || null,
      doneDefinition: row.done_definition || null,
      startedAt: null,
      completedAt: null,
    };

    return {
      core,
      work: { segments: [] },
      temporal: {
        tz: row.tz ?? null,
        releaseAt: null,
        dueAt: null,
        fixedStart: null,
        fixedEnd: null,
        activeStart: null,
        activeEnd: null,
      },
      objective: {
        objectiveMode: "finish_once",
        targetWorkMin: null,
        targetRestMin: null,
        doneRule: "manual",
        recurrence: null,
      },
      interruption: {
        interruptPenalty: 3,
        resumePenalty: 3,
        breakSplitsWork: true,
        externalInterruptOnly: false,
      },
      automation: {
        promptOnStart: false,
        promptOnEnd: true,
        autoStartAllowed: false,
        autoEndAllowed: false,
      },
      annotation: {
        semanticRole: "work",
        labels: [],
        timedLabels: [],
      },
    };
  }
}
