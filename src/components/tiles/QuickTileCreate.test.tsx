/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/use-translation", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		locale: "ja" as const,
	}),
}));

vi.mock("@/lib/hooks/use-media-query", () => ({
	useIsDesktop: () => false,
}));

const executeMock = vi.fn().mockResolvedValue(undefined);
const stateMock = { tiles: new Map() };

vi.mock("@/lib/hooks/execution-engine-context", () => ({
	useExecutionEngineContext: () => ({
		execute: executeMock,
		state: stateMock,
		loading: false,
	}),
}));

vi.mock("@/lib/daemon/id-token-client", () => ({
	getSessionClient: vi.fn().mockResolvedValue({ sub: "user-1" }),
}));

import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { QuickTileCreate } from "./QuickTileCreate";

function openPanel() {
	useQuickCreateStore.setState({ isOpen: true });
}

function closePanel() {
	useQuickCreateStore.setState({ isOpen: false });
}

beforeEach(() => {
	executeMock.mockClear();
	executeMock.mockResolvedValue(undefined);
	stateMock.tiles = new Map();
	openPanel();
});

afterEach(() => {
	closePanel();
});

describe("QuickTileCreate — no kind discriminator", () => {
	it("does not ask 'what kind of tile is this?' (no work/break/label buttons)", () => {
		render(<QuickTileCreate />);

		// Workspace memory forbids kind enums in UI; the panel must not
		// ask the user to classify the tile as work / break / label.
		expect(screen.queryByRole("button", { name: "quickCreate.kindTask" })).toBeNull();
		expect(screen.queryByRole("button", { name: "quickCreate.kindBreak" })).toBeNull();
		expect(screen.queryByRole("button", { name: "quickCreate.kindLabel" })).toBeNull();
	});

	it("does not render the split/keep work buttons (no 'is this a break?' discriminator)", () => {
		render(<QuickTileCreate />);

		// Schedule is now inlined in the base panel — no sub-panel to open.
		expect(
			screen.queryByRole("button", { name: "quickCreate.splitAllow" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "quickCreate.splitKeep" }),
		).toBeNull();
	});
});

describe("QuickTileCreate — accessibility", () => {
	it("title input shows placeholder and no section heading", () => {
		render(<QuickTileCreate />);

		expect(
			screen.getByRole("textbox", { name: /quickCreate\.titlePlaceholder/ }),
		).toBeTruthy();
		expect(screen.queryByRole("heading", { name: /quickCreate\.titleTitle/ })).toBeNull();
	});

	it("title input has aria-required='true' and an accessible name", () => {
		render(<QuickTileCreate />);

		const titleInput = screen.getByRole("textbox", {
			name: /quickCreate\.titlePlaceholder/,
		});
		expect(titleInput).toBeTruthy();
		expect(titleInput.getAttribute("aria-required")).toBe("true");
	});

	it("duration is a pill with a leading icon (no 'Estimated duration' heading)", () => {
		render(<QuickTileCreate />);

		expect(screen.queryByRole("heading", { name: /quickCreate\.workTargetTitle/ })).toBeNull();
		// DurationInput is reachable by its aria-label (which includes "hours" + "minutes" units).
		const duration = screen.getByRole("textbox", { name: /hours/i });
		expect(duration).toBeTruthy();
	});

	it("all visible date and time inputs have accessible names", () => {
		render(<QuickTileCreate />);

		// Schedule is now a single inline pill — click it to expand
		// the date+time inputs in place.
		const pill = screen.getByRole("button", { name: /quickCreate\.scheduleTitle/ });
		fireEvent.click(pill);

		const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/);
		const timeInputs = screen.getAllByDisplayValue(/\d{2}:\d{2}/);
		expect(dateInputs.length).toBeGreaterThan(0);
		expect(timeInputs.length).toBeGreaterThan(0);

		for (const input of [...dateInputs, ...timeInputs]) {
			// Either the input has a label (htmlFor) or aria-label.
			const labelled =
				input.hasAttribute("aria-label") ||
				input.hasAttribute("aria-labelledby") ||
				(input.id && document.querySelector(`label[for="${input.id}"]`) !== null);
			expect(labelled, `input ${input.outerHTML} has no accessible name`).toBe(true);
		}
	});

	it("error message announces via role='alert'", async () => {
		render(<QuickTileCreate />);

		// The submit button stays enabled even when the form is invalid;
		// clicking it surfaces a validation error in a role=alert region.
		const titleInput = screen.getByRole("textbox", {
			name: /quickCreate\.titlePlaceholder/,
		});
		// Force the title empty (overriding the auto-suggested value).
		fireEvent.change(titleInput, { target: { value: "" } });

		const submitButton = screen.getByRole("button", { name: "quickCreate.commit" });
		fireEvent.click(submitButton);

		await waitFor(() => {
			const alert = screen.queryByRole("alert");
			expect(alert).toBeTruthy();
		});
	});

	it("date/time is a single inline row that expands on pill click", () => {
		render(<QuickTileCreate />);

		expect(screen.queryByRole("heading", { name: /quickCreate\.scheduleTitle/ })).toBeNull();
		// The schedule pill is a button with aria-expanded
		const pill = screen.getByRole("button", { name: /quickCreate\.scheduleTitle/ });
		expect(pill.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(pill);
		expect(pill.getAttribute("aria-expanded")).toBe("true");
		// After click, date+time inputs are revealed inline
		expect(screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/).length).toBeGreaterThan(0);
	});

	it("sub-panel navigation buttons are localized via t()", () => {
		render(<QuickTileCreate />);

		// Schedule was promoted to the base panel — only 4 sub-panel
		// entries remain (Recurrence / Interrupt / Automation / Timed labels).
		expect(
			screen.getByRole("button", { name: /quickCreate\.recurrenceNavTitle/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /quickCreate\.metaNavTitle/ }),
		).toBeTruthy();
		// Schedule nav button must NOT exist (it's inlined in base panel).
		expect(
			screen.queryByRole("button", { name: /quickCreate\.scheduleNavTitle/ }),
		).toBeNull();
	});

	it("base panel exposes interrupt rules and automation nav entries", () => {
		render(<QuickTileCreate />);

		// Two additional sub-panels must appear in the nav list (4 total).
		expect(
			screen.getByRole("button", { name: /quickCreate\.interruptNavTitle/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /quickCreate\.automationNavTitle/ }),
		).toBeTruthy();
	});

	it("base panel exposes a DoneRule choice row", () => {
		render(<QuickTileCreate />);

		// The completion trigger is always required (not a sub-panel).
		expect(
			screen.getByRole("button", { name: "quickCreate.doneRuleTimeReached" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "quickCreate.doneRuleIntervalEnd" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "quickCreate.doneRuleManual" }),
		).toBeTruthy();
	});

	it("DoneRule row has no section heading; 3 options remain", () => {
		render(<QuickTileCreate />);
		expect(screen.queryByRole("heading", { name: /quickCreate\.doneRuleTitle/ })).toBeNull();
		expect(screen.getByRole("button", { name: /quickCreate\.doneRuleManual/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /quickCreate\.doneRuleTimeReached/ })).toBeTruthy();
		expect(screen.getByRole("button", { name: /quickCreate\.doneRuleIntervalEnd/ })).toBeTruthy();
	});

	it("base panel exposes a schedule pill + period label", () => {
		render(<QuickTileCreate />);

		// Schedule is a single inline pill that expands to show the
		// date+time inputs (no separate Start/End toggle buttons).
		expect(
			screen.getByRole("button", { name: /quickCreate\.scheduleTitle/ }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "quickCreate.startAt" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "quickCreate.endAt" }),
		).toBeNull();
		expect(
			screen.getByRole("checkbox", { name: /quickCreate\.labelOnly/ }),
		).toBeTruthy();
	});

	it("base panel exposes Project + Tag + Memo inputs", () => {
		render(<QuickTileCreate />);

		// Project / Tag were promoted from the meta sub-panel to the base
		// panel — they must be reachable without opening a sub-panel.
		expect(
			screen.getByRole("textbox", { name: /quickCreate\.projectPlaceholder/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("textbox", { name: /quickCreate\.tagsPlaceholder/ }),
		).toBeTruthy();
		// Memo is collapsed by default — only the "Add a note" placeholder
		// button is visible until the user clicks it.
		expect(
			screen.getByRole("button", { name: /quickCreate\.memoPlaceholder/ }),
		).toBeTruthy();
	});

	it("memo is collapsed by default; clicking 'Add note' reveals a textarea", () => {
		render(<QuickTileCreate />);
		// When empty, only an "Add note" placeholder button is visible, not a textarea
		expect(
			screen.queryByRole("textbox", { name: /quickCreate\.memoPlaceholder/ }),
		).toBeNull();
		// Click the placeholder to expand
		const addNote = screen.getByRole("button", { name: /quickCreate\.memoPlaceholder/ });
		fireEvent.click(addNote);
		expect(
			screen.getByRole("textbox", { name: /quickCreate\.memoPlaceholder/ }),
		).toBeTruthy();
	});

	it("project input has leading icon and no section heading", () => {
		render(<QuickTileCreate />);
		expect(screen.queryByRole("heading", { name: /quickCreate\.metaTitle/ })).toBeNull();
		// Project input still has a recognizable aria-label
		expect(
			screen.getByRole("textbox", { name: /quickCreate\.projectPlaceholder/ }),
		).toBeTruthy();
	});

	it("tag input is icon-driven and addable via Enter", () => {
		render(<QuickTileCreate />);
		const tagInput = screen.getByRole("textbox", { name: /quickCreate\.tagsPlaceholder/ });
		fireEvent.change(tagInput, { target: { value: "important" } });
		fireEvent.keyDown(tagInput, { key: "Enter" });
		// Chip is rendered with the tag
		expect(screen.getByText("#important")).toBeTruthy();
	});
});

describe("QuickTileCreate — interruption & automation layers", () => {
	it("interrupt rules sub-panel sets interruptPenalty / resumePenalty / externalInterruptOnly", async () => {
		render(<QuickTileCreate />);

		// Open the Interrupt rules sub-panel.
		fireEvent.click(
			screen.getByRole("button", { name: /quickCreate\.interruptNavTitle/ }),
		);

		// Set both penalties to 5 and enable external-interrupts-only.
		const penalty5 = screen.getAllByRole("button", { name: "5" });
		fireEvent.click(penalty5[0]);
		fireEvent.click(penalty5[1]);
		fireEvent.click(
			screen.getByRole("checkbox", {
				name: /quickCreate\.externalInterruptOnlyTitle/,
			}),
		);

		// Submit with the auto-suggested title.
		fireEvent.click(screen.getByRole("button", { name: "quickCreate.commit" }));

		await waitFor(() => expect(executeMock).toHaveBeenCalled());
		const [command] = executeMock.mock.calls[0];
		expect(command.tile.interruption.interruptPenalty).toBe(5);
		expect(command.tile.interruption.resumePenalty).toBe(5);
		expect(command.tile.interruption.externalInterruptOnly).toBe(true);
		// breakSplitsWork must remain the default and NOT be exposed in UI.
		expect(command.tile.interruption.breakSplitsWork).toBe(true);
	});

	it("automation sub-panel toggles all four booleans + timezone", async () => {
		render(<QuickTileCreate />);

		// Open the Automation sub-panel.
		fireEvent.click(
			screen.getByRole("button", { name: /quickCreate\.automationNavTitle/ }),
		);

		// Toggle promptOnStart, autoStartAllowed, autoEndAllowed on.
		// promptOnEnd is on by default per Tile.create — leave it.
		fireEvent.click(
			screen.getByRole("checkbox", { name: /quickCreate\.promptOnStartTitle/ }),
		);
		fireEvent.click(
			screen.getByRole("checkbox", { name: /quickCreate\.autoStartAllowedTitle/ }),
		);
		fireEvent.click(
			screen.getByRole("checkbox", { name: /quickCreate\.autoEndAllowedTitle/ }),
		);

		// Pick Asia/Tokyo from the timezone select.
		fireEvent.change(
			screen.getByRole("combobox", { name: /quickCreate\.timezoneTitle/ }),
			{ target: { value: "Asia/Tokyo" } },
		);

		// Submit.
		fireEvent.click(screen.getByRole("button", { name: "quickCreate.commit" }));

		await waitFor(() => expect(executeMock).toHaveBeenCalled());
		const [command] = executeMock.mock.calls[0];
		expect(command.tile.automation.promptOnStart).toBe(true);
		expect(command.tile.automation.promptOnEnd).toBe(true);
		expect(command.tile.automation.autoStartAllowed).toBe(true);
		expect(command.tile.automation.autoEndAllowed).toBe(true);
		expect(command.tile.temporal.tz).toBe("Asia/Tokyo");
	});

	it("tz defaults to null (device timezone) when not changed", async () => {
		render(<QuickTileCreate />);

		fireEvent.click(screen.getByRole("button", { name: "quickCreate.commit" }));

		await waitFor(() => expect(executeMock).toHaveBeenCalled());
		const [command] = executeMock.mock.calls[0];
		expect(command.tile.temporal.tz).toBeNull();
	});

	it("doneRule choice row drives tile.objective.doneRule", async () => {
		render(<QuickTileCreate />);

		// Pick "When target work reached".
		fireEvent.click(
			screen.getByRole("button", { name: "quickCreate.doneRuleTimeReached" }),
		);

		fireEvent.click(screen.getByRole("button", { name: "quickCreate.commit" }));

		await waitFor(() => expect(executeMock).toHaveBeenCalled());
		const [command] = executeMock.mock.calls[0];
		expect(command.tile.objective.doneRule).toBe("time_reached");
	});
});

describe("QuickTileCreate — timed labels", () => {
	it("Meta sub-panel adds a timed label to annotation.timedLabels", async () => {
		render(<QuickTileCreate />);

		// Open the Meta (Project & metadata) sub-panel.
		fireEvent.click(
			screen.getByRole("button", { name: /quickCreate\.metaNavTitle/ }),
		);

		// Fill the label input.
		const labelInput = screen.getByRole("textbox", {
			name: /quickCreate\.timedLabelsLabel/,
		});
		fireEvent.change(labelInput, { target: { value: "vacation" } });

		// Click Add.
		fireEvent.click(
			screen.getByRole("button", { name: "quickCreate.timedLabelsAdd" }),
		);

		// Submit.
		fireEvent.click(screen.getByRole("button", { name: "quickCreate.commit" }));

		await waitFor(() => expect(executeMock).toHaveBeenCalled());
		const [command] = executeMock.mock.calls[0];
		expect(command.tile.annotation.timedLabels).toEqual([
			{ label: "vacation", startAt: null, endAt: null },
		]);
	});
});

describe("QuickTileCreate — submit semantics", () => {
	it("submits a task tile with targetWorkMin, never targetRestMin", async () => {
		render(<QuickTileCreate />);

		// Fill the title so the form can submit.
		const titleInput = screen.getByRole("textbox", { name: /quickCreate\.titlePlaceholder/ });
		fireEvent.change(titleInput, { target: { value: "Write report" } });

		// Submit.
		const submitButton = screen.getByRole("button", { name: "quickCreate.commit" });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(executeMock).toHaveBeenCalled();
		});

		const [command] = executeMock.mock.calls[0];
		expect(command.type).toBe("create_tile");
		const tile = command.tile;
		// Tile must be classified by its condition vector, not by kind.
		// The duration field always represents target work; the engine
		// owns break placement via the recurrence generator.
		expect(tile.objective.targetRestMin).toBeNull();
		// targetWorkMin should be a positive number (default 25 min from the panel).
		expect(tile.objective.targetWorkMin).toBeGreaterThan(0);
		// No semantic role of 'break'.
		expect(tile.annotation.semanticRole).not.toBe("break");
	});

	it("label-only toggle hides the duration field and sets objectiveMode = label_only", async () => {
		render(<QuickTileCreate />);

		// The label-only toggle is now inlined in the base panel — no
		// sub-panel to open. The toggle is a real checkbox (not a
		// ChoiceButton), reachable by role and accessible name.
		const labelToggle = screen.getByRole("checkbox", {
			name: /quickCreate\.labelOnly/,
		});
		expect(labelToggle).toBeTruthy();
		fireEvent.click(labelToggle);

		// Fill the title so the form can submit.
		const titleInput = screen.getByRole("textbox", {
			name: /quickCreate\.titlePlaceholder/,
		});
		fireEvent.change(titleInput, { target: { value: "Vacation" } });

		// Submit.
		const submitButton = screen.getByRole("button", { name: "quickCreate.commit" });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(executeMock).toHaveBeenCalled();
		});

		const [command] = executeMock.mock.calls[0];
		const tile = command.tile;
		expect(tile.objective.objectiveMode).toBe("label_only");
		// No work target, no rest target for a period label.
		expect(tile.objective.targetWorkMin).toBeNull();
		expect(tile.objective.targetRestMin).toBeNull();
	});
});