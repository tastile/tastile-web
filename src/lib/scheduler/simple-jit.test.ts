import { describe, expect, it } from "vitest";
import { AppState } from "@/execution/model/state";
import { TileId } from '@/shared/model/ids';
import { Tile } from "@/tile/model/types";
import { selectNextTile } from "./simple-jit";

describe("selectNextTile", () => {
	it("picks a non-completed, non-active tile with nextAction", () => {
		const state = AppState.initial();
		const active = Tile.create(TileId.new(), "Active");
		active.core.startedAt = new Date("2026-03-16T10:00:00.000Z");

		const candidate = Tile.create(TileId.new(), "Candidate");
		candidate.core.nextAction = "Open PR";

		const done = Tile.create(TileId.new(), "Done");
		done.core.completedAt = new Date();

		state.tiles.set(active.core.id, active);
		state.tiles.set(candidate.core.id, candidate);
		state.tiles.set(done.core.id, done);
		state.execution.activeTileId = active.core.id;

		const suggestion = selectNextTile(state);

		expect(suggestion?.tile.core.id).toBe(candidate.core.id);
	});
});
