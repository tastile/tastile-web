import { describe, expect, it } from "vitest";
import { Actor } from '@/tile/model/actor';
import { TileId } from '@/shared/model/ids';
import { getTileLifecycle, Tile } from '@/tile/model/tile';
import { CommandEnvelope } from "./command";
import { CommandHandler } from "./handler";
import { AppState } from "./state";

describe("CommandHandler", () => {
	it("creates a tile and stores it in state through reducer application", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const tileId = TileId.new();
		const tile = Tile.create(tileId, "Write release notes");
		tile.core.nextAction = "Draft changelog";

		const events = handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: tileId,
					tile,
				},
				Actor.human("user-1"),
			),
			state,
		);

		expect(events).toHaveLength(1);
		expect(events[0].event.type).toBe("tile_created");
		expect(state.tiles.get(tileId)?.core.title).toBe("Write release notes");
		expect(state.tiles.get(tileId)?.core.nextAction).toBe("Draft changelog");
	});

	it("completes an active tile and returns execution to idle", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const tileId = TileId.new();
		const actor = Actor.human("user-1");
		const now = new Date("2026-03-16T09:00:00.000Z");
		const tile = Tile.create(tileId, "Ship dashboard");

		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: tileId,
					tile,
				},
				actor,
			),
			state,
		);

		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: tileId,
					started_at: now,
					source: "manual",
				},
				actor,
			),
			state,
		);

		const completionEvents = handler.handle(
			CommandEnvelope.create(
				{
					type: "complete_tile",
					tile_id: tileId,
					completed_at: new Date("2026-03-16T09:25:00.000Z"),
					next_tile_id: null,
				},
				actor,
			),
			state,
		);

		expect(completionEvents.map((e) => e.event.type)).toEqual([
			"segment_ended",
			"tile_completed",
		]);
		expect(getTileLifecycle(state.tiles.get(tileId)!)).toBe("done");
		expect(state.execution.activeTileId).toBeNull();
	});

	it("supports start_break -> end_break loop with break tile lifecycle", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const tileId = TileId.new();
		const actor = Actor.human("user-1");
		const now = new Date("2026-03-16T10:00:00.000Z");
		const tile = Tile.create(tileId, "Deep work");
		tile.objective.targetWorkMin = 15;

		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: tileId,
					tile,
				},
				actor,
			),
			state,
		);

		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: tileId,
					started_at: now,
					source: "manual",
				},
				actor,
			),
			state,
		);

		const startBreakEvents = handler.handle(
			CommandEnvelope.create(
				{
					type: "start_break",
					linked_tile_id: tileId,
					break_min: 5,
					reason: "regression break",
				},
				actor,
			),
			state,
		);

		expect(startBreakEvents.map((e) => e.event.type)).toContain(
			"break_started",
		);
		expect(state.execution.phaseKind).toBe("break");
		const breakTile = Array.from(state.tiles.values()).find(
			(t) => t.annotation.semanticRole === "break",
		);
		expect(breakTile).toBeTruthy();
		expect(state.execution.activeTileId).toBe(breakTile?.core.id);

		const endBreakEvents = handler.handle(
			CommandEnvelope.create(
				{
					type: "end_break",
					tile_id: null,
					ended_at: new Date("2026-03-16T10:05:00.000Z"),
				},
				actor,
			),
			state,
		);

		expect(endBreakEvents.map((e) => e.event.type)).toContain("break_ended");
		const endedBreakTile = Array.from(state.tiles.values()).find(
			(t) => t.annotation.semanticRole === "break",
		);
		expect(endedBreakTile?.core.completedAt).not.toBeNull();
		expect(state.execution.phaseKind).toBe("idle");
		expect(state.execution.activeTileId).toBeNull();
	});

	it("allows parallel start on another tile while one is active (core parity)", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const actor = Actor.human("user-1");
		const tileA = TileId.new();
		const tileB = TileId.new();
		const now = new Date("2026-03-16T11:00:00.000Z");

		handler.handle(
			CommandEnvelope.create(
				{ type: "create_tile", tile_id: tileA, tile: Tile.create(tileA, "A") },
				actor,
			),
			state,
		);
		handler.handle(
			CommandEnvelope.create(
				{ type: "create_tile", tile_id: tileB, tile: Tile.create(tileB, "B") },
				actor,
			),
			state,
		);

		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: tileA,
					started_at: now,
					source: "manual",
				},
				actor,
			),
			state,
		);

		expect(() =>
			handler.handle(
				CommandEnvelope.create(
					{
						type: "start_tile",
						tile_id: tileB,
						started_at: new Date("2026-03-16T11:01:00.000Z"),
						source: "manual",
					},
					actor,
				),
				state,
			),
		).not.toThrow();
	});

	it("interrupts current tile and switches active execution to target tile", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const actor = Actor.human("user-1");
		const fromTileId = TileId.new();
		const toTileId = TileId.new();
		const startAt = new Date("2026-03-16T12:00:00.000Z");
		const switchAt = new Date("2026-03-16T12:07:00.000Z");

		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: fromTileId,
					tile: Tile.create(fromTileId, "Current Task"),
				},
				actor,
			),
			state,
		);
		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: toTileId,
					tile: Tile.create(toTileId, "Next Task"),
				},
				actor,
			),
			state,
		);
		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: fromTileId,
					started_at: startAt,
					source: "manual",
				},
				actor,
			),
			state,
		);

		const switchEvents = handler.handle(
			CommandEnvelope.create(
				{
					type: "switch_active_tile",
					from_tile_id: fromTileId,
					to_tile_id: toTileId,
					switched_at: switchAt,
					reason: "manual switch",
					interrupt_source: "user_switch",
				} as never,
				actor,
			),
			state,
		);

		expect(switchEvents.map((e) => e.event.type)).toContain("tile_interrupted");
		expect(state.execution.activeTileId).toBe(toTileId);
		expect(state.execution.phaseKind).toBe("work");
	});

	it("does not emit prompt_scheduled again when a pending prompt already exists", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const actor = Actor.human("user-1");
		const tileId = TileId.new();
		const tile = Tile.create(tileId, "Prompt target");
		const at = new Date("2026-03-16T13:00:00.000Z");

		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: tileId,
					tile,
				},
				actor,
			),
			state,
		);

		state.execution.pendingPrompt = {
			promptId: "existing-prompt",
			tileId,
			kind: "end_tile",
			severity: "soft",
			suggestedMinutes: null,
			reasons: ["already_pending"],
			actions: ["complete_tile", "dismiss"],
			scheduledAt: at,
			reason: "Already pending",
		};

		const events = handler.handle(
			CommandEnvelope.create(
				{
					type: "request_prompt",
					tile_id: tileId,
					requested_at: at,
					reason: "status_icon",
				},
				actor,
			),
			state,
		);

		expect(events).toHaveLength(0);
		expect(state.execution.pendingPrompt?.promptId).toBe("existing-prompt");
	});

	it("closes the current segment at now when extending a phase", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const actor = Actor.human("user-1");
		const tileId = TileId.new();
		const startedAt = new Date("2026-03-16T14:00:00.000Z");
		const issuedAt = new Date("2026-03-16T14:10:00.000Z");

		handler.handle(
			CommandEnvelope.create(
				{
					type: "create_tile",
					tile_id: tileId,
					tile: Tile.create(tileId, "Extend target"),
				},
				actor,
			),
			state,
		);
		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: tileId,
					started_at: startedAt,
					source: "manual",
				},
				actor,
			),
			state,
		);

		const envelope = CommandEnvelope.create(
			{ type: "extend_phase", tile_id: tileId, delta_min: 5 } as never,
			actor,
		);
		envelope.issued_at = issuedAt;

		const events = handler.handle(envelope, state);

		const segmentEnded = events.find(
			(event) => event.event.type === "segment_ended",
		);
		const segmentStarted = events.find(
			(event) => event.event.type === "segment_started",
		);
		expect(segmentEnded?.event.type).toBe("segment_ended");
		if (segmentEnded?.event.type === "segment_ended") {
			expect(segmentEnded.event.ended_at).toEqual(issuedAt);
		}
		expect(segmentStarted?.event.type).toBe("segment_started");
		if (segmentStarted?.event.type === "segment_started") {
			expect(segmentStarted.event.expected_end_at?.toISOString()).toBe(
				"2026-03-16T14:15:00.000Z",
			);
		}
		expect(state.execution.phaseEndsAt?.toISOString()).toBe(
			"2026-03-16T14:15:00.000Z",
		);
	});

	it("generates a fresh prompt id each time a prompt is rescheduled", () => {
		const state = AppState.initial();
		const handler = new CommandHandler();
		const actor = Actor.human("user-1");
		const tileId = TileId.new();
		const tile = Tile.create(tileId, "Prompt target");
		const startedAt = new Date("2026-03-16T15:00:00.000Z");

		handler.handle(
			CommandEnvelope.create(
				{ type: "create_tile", tile_id: tileId, tile },
				actor,
			),
			state,
		);
		handler.handle(
			CommandEnvelope.create(
				{
					type: "start_tile",
					tile_id: tileId,
					started_at: startedAt,
					source: "manual",
				},
				actor,
			),
			state,
		);

		const first = handler.handle(
			CommandEnvelope.create(
				{
					type: "request_prompt",
					tile_id: tileId,
					requested_at: new Date("2026-03-16T15:05:00.000Z"),
					reason: "status_icon",
				},
				actor,
			),
			state,
		);
		const firstPrompt = first.find(
			(event) => event.event.type === "prompt_scheduled",
		);
		if (!firstPrompt || firstPrompt.event.type !== "prompt_scheduled") {
			throw new Error("Expected first prompt_scheduled event");
		}

		handler.handle(
			CommandEnvelope.create(
				{
					type: "clear_prompt",
					prompt_id: firstPrompt.event.prompt_id,
					reason: "dismissed",
				},
				actor,
			),
			state,
		);

		const second = handler.handle(
			CommandEnvelope.create(
				{
					type: "request_prompt",
					tile_id: tileId,
					requested_at: new Date("2026-03-16T15:06:00.000Z"),
					reason: "status_icon",
				},
				actor,
			),
			state,
		);
		const secondPrompt = second.find(
			(event) => event.event.type === "prompt_scheduled",
		);
		if (!secondPrompt || secondPrompt.event.type !== "prompt_scheduled") {
			throw new Error("Expected second prompt_scheduled event");
		}

		expect(secondPrompt.event.prompt_id).not.toBe(firstPrompt.event.prompt_id);
	});
});
