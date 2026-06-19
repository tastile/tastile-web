/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExecutionEngine } from "./use-execution-engine";

const {
	getSessionClientMock,
	getIdTokenClientMock,
	readSnapshotMock,
	readTilesMock,
	readExecutionViewMock,
	readPendingPromptMock,
	readTodayTimelineMock,
	readSyncStatusMock,
	restoreSessionMock,
	openExecutionStreamMock,
	sendCommandMock,
} = vi.hoisted(() => ({
	getSessionClientMock: vi.fn(),
	getIdTokenClientMock: vi.fn(),
	readSnapshotMock: vi.fn(),
	readTilesMock: vi.fn(),
	readExecutionViewMock: vi.fn(),
	readPendingPromptMock: vi.fn(),
	readTodayTimelineMock: vi.fn(),
	readSyncStatusMock: vi.fn(),
	restoreSessionMock: vi.fn(),
	openExecutionStreamMock: vi.fn(() => ({ close: vi.fn() })),
	sendCommandMock: vi.fn(),
}));
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/daemon/id-token-client", () => ({
	getSessionClient: getSessionClientMock,
	getIdTokenClient: getIdTokenClientMock,
	clearSessionCache: vi.fn(),
}));

vi.mock("../daemon/client", () => ({
	DaemonClient: class {
		readSnapshot = readSnapshotMock;
		readTiles = readTilesMock;
		readExecutionView = readExecutionViewMock;
		readPendingPrompt = readPendingPromptMock;
		readTodayTimeline = readTodayTimelineMock;
		readSyncStatus = readSyncStatusMock;
		restoreSession = restoreSessionMock;
		sendCommand = sendCommandMock;
	},
}));

vi.mock("../daemon/stream", () => ({
	openExecutionStream: openExecutionStreamMock,
}));

function Probe() {
	const { loading } = useExecutionEngine();
	return <div data-testid="loading">{loading ? "yes" : "no"}</div>;
}

describe("useExecutionEngine", () => {
	beforeEach(() => {
		process.env.NEXT_PUBLIC_EXECUTION_BACKEND = "daemon";
		process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS = "60000";
		getSessionClientMock.mockReset();
		getIdTokenClientMock.mockReset();
		readSnapshotMock.mockReset();
		readTilesMock.mockReset();
		readExecutionViewMock.mockReset();
		readPendingPromptMock.mockReset();
		readTodayTimelineMock.mockReset();
		readSyncStatusMock.mockReset();
		restoreSessionMock.mockReset();
		sendCommandMock.mockReset();
		openExecutionStreamMock.mockClear();
		consoleErrorSpy.mockClear();
		getSessionClientMock.mockResolvedValue({
			idToken: "id-token-1",
			refreshToken: "refresh-token-1",
			sub: "user-1",
			exp: 1774706400,
		});
		getIdTokenClientMock.mockResolvedValue("id-token-1");
		restoreSessionMock.mockResolvedValue(undefined);
		readSyncStatusMock.mockResolvedValue({
			inProgress: false,
			lastAttemptAt: null,
			lastSuccessAt: null,
			lastError: null,
			lastResult: null,
		});
	});

	it("stops loading when initial event replay fails", async () => {
		readSnapshotMock.mockRejectedValue(new Error("boom"));

		render(<Probe />);

		await waitFor(() => {
			expect(screen.getByTestId("loading").textContent).toBe("no");
		});
	});
});
