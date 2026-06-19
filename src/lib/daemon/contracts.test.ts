import { describe, expect, it } from "vitest";
import { parseExecutionSnapshot } from "./contracts";

const mockPayload = {
	in_progress_tiles: [
		{
			tile_id: "41612f8d-afb8-484e-9c67-99bc3c007de1",
			title: "Write spec",
			phase_kind: "work",
			started_at: "2026-03-26T09:00:00.000Z",
			phase_ends_at: "2026-03-26T09:25:00.000Z",
		},
		{
			tile_id: "7f6f0a59-4d26-4f13-883b-a4f76f12bc21",
			title: "Review PR",
			phase_kind: "work",
			started_at: "2026-03-26T09:15:00.000Z",
			phase_ends_at: "2026-03-26T09:40:00.000Z",
		},
	],
	prompt_queue: [
		{
			prompt_id: "prompt-1",
			tile_id: "41612f8d-afb8-484e-9c67-99bc3c007de1",
			kind: "start_tile",
			severity: "soft",
			suggested_minutes: 25,
			reasons: ["resume_in_flight"],
			actions: ["start_tile", "defer_tile", "dismiss"],
			scheduled_at: "2026-03-26T09:20:00.000Z",
			reason: "Resume in-flight tile",
			status: "pending",
		},
	],
	timeline: [
		{
			id: "segment-1",
			tile_id: "41612f8d-afb8-484e-9c67-99bc3c007de1",
			title: "Write spec",
			type: "work",
			status: "active",
			start_at: "2026-03-26T09:00:00.000Z",
			end_at: null,
		},
	],
};

describe("daemon contracts", () => {
	it("parses timeline/prompt queue/in-progress tiles from daemon snapshot", () => {
		const snapshot = parseExecutionSnapshot(mockPayload);
		expect(snapshot.inProgressTiles.length).toBeGreaterThan(1);
		expect(snapshot.inProgressTiles[0].phaseEndsAt instanceof Date).toBe(true);
		expect(snapshot.promptQueue[0].status).toBe("pending");
		expect(snapshot.timeline[0].startAt instanceof Date).toBe(true);
	});

	it("rejects camelCase-only payload to enforce strict daemon field contract", () => {
		expect(() =>
			parseExecutionSnapshot({
				inProgressTiles: mockPayload.in_progress_tiles,
				promptQueue: mockPayload.prompt_queue,
				timeline: mockPayload.timeline,
			}),
		).toThrowError(/Missing required field: in_progress_tiles/);
	});

	it("rejects invalid date fields", () => {
		expect(() =>
			parseExecutionSnapshot({
				...mockPayload,
				timeline: [
					{
						...mockPayload.timeline[0],
						start_at: "not-a-date",
					},
				],
			}),
		).toThrowError(/Invalid start_at: expected ISO date string/);
	});

	it("accepts UTC fractional seconds up to 9 digits", () => {
		const snapshot = parseExecutionSnapshot({
			...mockPayload,
			timeline: [
				{
					...mockPayload.timeline[0],
					start_at: "2026-03-26T09:00:00.123456789Z",
				},
			],
		});
		expect(snapshot.timeline[0].startAt instanceof Date).toBe(true);
	});

	it("rejects non-UTC timezone offsets", () => {
		expect(() =>
			parseExecutionSnapshot({
				...mockPayload,
				timeline: [
					{
						...mockPayload.timeline[0],
						start_at: "2026-03-26T18:00:00+09:00",
					},
				],
			}),
		).toThrowError(/Invalid start_at: expected ISO date string/);
	});

	it("treats non-uuid tile ids as null instead of crashing", () => {
		const snapshot = parseExecutionSnapshot({
			...mockPayload,
			timeline: [
				{
					...mockPayload.timeline[0],
					tile_id: "synthetic:break:1774521250:4:1774535950",
				},
			],
		});
		expect(snapshot.timeline[0].tileId).toBeNull();
	});

	it("accepts urn:uuid tile ids", () => {
		const snapshot = parseExecutionSnapshot({
			...mockPayload,
			timeline: [
				{
					...mockPayload.timeline[0],
					tile_id: "urn:uuid:41612f8d-afb8-484e-9c67-99bc3c007de1",
				},
			],
		});
		expect(snapshot.timeline[0].tileId).toBe(
			"41612f8d-afb8-484e-9c67-99bc3c007de1",
		);
	});

	it("parses startup recovery prompt actions from daemon snapshot", () => {
		const snapshot = parseExecutionSnapshot({
			...mockPayload,
			prompt_queue: [
				{
					...mockPayload.prompt_queue[0],
					actions: [
						"confirm_continue",
						"confirm_stop_at",
						"confirm_executed",
						"confirm_skipped",
						"dismiss",
					],
				},
			],
		});
		expect(snapshot.promptQueue[0].actions).toEqual([
			"confirm_continue",
			"confirm_stop_at",
			"confirm_executed",
			"confirm_skipped",
			"dismiss",
		]);
	});
});
