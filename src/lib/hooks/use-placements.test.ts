/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callMock = vi.fn();

vi.mock("@/lib/api/endpoints", () => ({
	getCoreClient: () => ({ call: callMock }),
}));

interface PlacementRow {
	id: string;
	work_tile_id: string;
	time_tile_id: string;
	planned_minutes: number;
}

interface CandidateRow {
	work_tile_id: string;
}

interface PlacementsResponse {
	placements: PlacementRow[];
}

interface CandidatesResponse {
	candidates: CandidateRow[];
}

function placementsResponse(rows: PlacementRow[]): PlacementsResponse {
	return { placements: rows };
}

function candidatesResponse(rows: CandidateRow[]): CandidatesResponse {
	return { candidates: rows };
}

describe("usePlacements / useCandidates", () => {
	beforeEach(() => {
		callMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("loads placements from /read/placements on mount", async () => {
		callMock.mockResolvedValue({
			ok: true,
			data: placementsResponse([
				{
					id: "p-1",
					work_tile_id: "w-1",
					time_tile_id: "t-1",
					planned_minutes: 30,
				},
			]),
		});

		const { usePlacements } = await import("./use-placements");
		const { result } = renderHook(() => usePlacements());
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(callMock).toHaveBeenCalledWith("getPlacements");
		expect(result.current.placements).toHaveLength(1);
		expect(result.current.placements[0]?.work_tile_id).toBe("w-1");
		expect(result.current.error).toBeNull();
	});

	it("exposes error state when the endpoint fails", async () => {
		callMock.mockResolvedValue({
			ok: false,
			error: { kind: "server", status: 500, message: "boom", body: null },
		});

		const { usePlacements } = await import("./use-placements");
		const { result } = renderHook(() => usePlacements());
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.placements).toEqual([]);
		expect(result.current.error?.message).toBe("boom");
	});

	it("refresh() re-fetches /read/placements", async () => {
		callMock.mockResolvedValueOnce({
			ok: true,
			data: placementsResponse([]),
		});
		callMock.mockResolvedValueOnce({
			ok: true,
			data: placementsResponse([
				{
					id: "p-2",
					work_tile_id: "w-2",
					time_tile_id: "t-2",
					planned_minutes: 25,
				},
			]),
		});

		const { usePlacements } = await import("./use-placements");
		const { result } = renderHook(() => usePlacements());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			await result.current.refresh();
		});

		expect(callMock).toHaveBeenCalledTimes(2);
		expect(result.current.placements).toHaveLength(1);
	});

	it("loads candidates from /read/candidates on mount", async () => {
		callMock.mockResolvedValue({
			ok: true,
			data: candidatesResponse([{ work_tile_id: "w-9" }]),
		});

		const { useCandidates } = await import("./use-placements");
		const { result } = renderHook(() => useCandidates());
		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(callMock).toHaveBeenCalledWith("getCandidates");
		expect(result.current.candidates).toHaveLength(1);
		expect(result.current.candidates[0]?.work_tile_id).toBe("w-9");
	});
});