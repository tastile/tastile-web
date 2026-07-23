/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { TileId } from "@/lib/domain/ids";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/lib/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key, locale: "ja" as const }),
}));

const executeMock = vi.fn();
vi.mock("@/lib/hooks/execution-engine-context", () => ({
	useExecutionEngineContext: () => ({
		execute: executeMock,
		state: { execution: { activeTileId: null } },
		loading: false,
	}),
}));

vi.mock("@/components/execution/GlobalPromptBanner", () => ({
	GlobalPromptBanner: ({
		onAction,
	}: {
		prompt: unknown;
		onAction: (action: string, payload?: { deferMinutes?: number }) => void;
		onDismiss: () => void;
	}) => (
		<div data-testid="prompt-banner">
			<button onClick={() => onAction("start_tile", {})}>start-tile</button>
			<button onClick={() => onAction("dismiss", {})}>dismiss</button>
		</div>
	),
}));

beforeEach(() => {
	executeMock.mockReset();
	executeMock.mockResolvedValue(undefined);
	Object.defineProperty(window, "localStorage", {
		value: { getItem: vi.fn(() => null), setItem: vi.fn() },
		configurable: true,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("AppShell prompt action handling", () => {
	it("sends the resolved command and the clear_prompt command in sequence, then resets handlingPromptAction", async () => {
		renderWithMantine(
			<AppShell
				executionState={{
					activeTileTitle: "Deep work",
					phaseKind: "work",
					phaseStartedAt: new Date("2026-03-26T09:00:00.000Z"),
					phaseEndsAt: new Date("2026-03-26T09:25:00.000Z"),
					pendingPrompt: {
						promptId: "p-1",
						tileId: TileId.fromString("tile-1"),
						kind: "start_tile",
						severity: "soft",
						suggestedMinutes: 25,
						reasons: ["resume_in_flight"],
						actions: ["start_tile", "dismiss"],
						scheduledAt: new Date("2026-03-26T09:00:00.000Z"),
						reason: "resume",
					},
				}}
			>
				<div>child</div>
			</AppShell>,
		);

		fireEvent.click(screen.getByText("start-tile"));

		await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2));
		expect(executeMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				type: "start_tile",
				tile_id: "tile-1",
			}),
			expect.objectContaining({ type: "human" }),
		);
		expect(executeMock).toHaveBeenNthCalledWith(
			2,
			{ type: "clear_prompt", prompt_id: "p-1", reason: "actioned" },
			expect.objectContaining({ type: "human" }),
		);
	});

	it("sends only clear_prompt when the action maps to null (dismiss)", async () => {
		renderWithMantine(
			<AppShell
				executionState={{
					activeTileTitle: "Deep work",
					phaseKind: "work",
					phaseStartedAt: new Date("2026-03-26T09:00:00.000Z"),
					phaseEndsAt: new Date("2026-03-26T09:25:00.000Z"),
					pendingPrompt: {
						promptId: "p-2",
						tileId: TileId.fromString("tile-2"),
						kind: "start_tile",
						severity: "soft",
						suggestedMinutes: 25,
						reasons: ["resume_in_flight"],
						actions: ["start_tile", "dismiss"],
						scheduledAt: new Date("2026-03-26T09:00:00.000Z"),
						reason: "resume",
					},
				}}
			>
				<div>child</div>
			</AppShell>,
		);

		fireEvent.click(screen.getByText("dismiss"));

		await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1));
		expect(executeMock).toHaveBeenCalledWith(
			{ type: "clear_prompt", prompt_id: "p-2", reason: "dismissed" },
			expect.objectContaining({ type: "human" }),
		);
	});
});