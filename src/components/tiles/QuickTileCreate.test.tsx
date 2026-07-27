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

vi.mock("@/lib/daemon/id-token-client", () => ({
	getIdTokenClient: vi.fn().mockResolvedValue("test-token"),
}));

const submitMock = vi.fn().mockResolvedValue({ ok: true, tileId: "tile-uuidv7" });

vi.mock("@/lib/api/v1/submit", () => ({
	makeClient: () => ({ baseUrl: "", getIdToken: () => Promise.resolve("test-token") }),
	submitCreateTile: (options: { client: unknown }) => submitMock(options),
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
	submitMock.mockClear();
	submitMock.mockResolvedValue({ ok: true, tileId: "tile-uuidv7" });
	// Reset the store to defaults before each test.
	useQuickCreateStore.setState(useQuickCreateStore.getInitialState());
	openPanel();
});

afterEach(() => {
	closePanel();
});

describe("QuickTileCreate — visibility", () => {
	it("does not render when the store is closed", () => {
		closePanel();
		render(<QuickTileCreate />);
		expect(screen.queryByRole("textbox", { name: /titlePlaceholder/ })).toBeNull();
	});

	it("renders all 7 section headers when open", () => {
		render(<QuickTileCreate />);
		// §1 Identity, §2 Plan, §3 Time, §4 Windows, §6 Advanced, §7 Meta
		// §5 Recurring only appears when kind=RECURRING
		const headers = screen.getAllByTestId("section-header");
		const titles = headers.map((h) => h.textContent ?? "");
		expect(titles.some((t) => t.includes("§1 Identity"))).toBe(true);
		expect(titles.some((t) => t.includes("§2 Plan"))).toBe(true);
		expect(titles.some((t) => t.includes("§3 Time"))).toBe(true);
		expect(titles.some((t) => t.includes("§4 Windows"))).toBe(true);
		expect(titles.some((t) => t.includes("§6 Advanced"))).toBe(true);
		expect(titles.some((t) => t.includes("§7 Meta"))).toBe(true);
	});
});

describe("QuickTileCreate — §1 Identity", () => {
	it("title input is required and reads/writes via the store", () => {
		render(<QuickTileCreate />);
		const title = screen.getByRole("textbox", { name: /titlePlaceholder/ });
		expect(title.getAttribute("aria-required")).toBe("true");
		fireEvent.change(title, { target: { value: "Read a book" } });
		expect(useQuickCreateStore.getState().identity.title).toBe("Read a book");
	});

	it("description textarea reads/writes via identity.description", () => {
		render(<QuickTileCreate />);
		const desc = screen.getByRole("textbox", {
			name: /descriptionPlaceholder/,
		});
		fireEvent.change(desc, { target: { value: "A long-form note" } });
		expect(useQuickCreateStore.getState().identity.description).toBe(
			"A long-form note",
		);
		// Empty input clears to null
		fireEvent.change(desc, { target: { value: "   " } });
		expect(useQuickCreateStore.getState().identity.description).toBeNull();
	});

	it("visual color picker writes to identity.visual.color", () => {
		render(<QuickTileCreate />);
		const color = screen.getByLabelText(/visualColorLabel/) as HTMLInputElement;
		fireEvent.change(color, { target: { value: "#ff8800" } });
		expect(useQuickCreateStore.getState().identity.visual.color).toBe(
			"#ff8800",
		);
	});

	it("visual icon input writes to identity.visual.icon", () => {
		render(<QuickTileCreate />);
		const icon = screen.getByRole("textbox", { name: /visualIconLabel/ });
		fireEvent.change(icon, { target: { value: "book-open" } });
		expect(useQuickCreateStore.getState().identity.visual.icon).toBe(
			"book-open",
		);
	});

	it("kind selector offers RECURRING / PLACEMENT / EXECUTION", () => {
		render(<QuickTileCreate />);
		expect(
			screen.getByRole("radio", { name: /kindRecurring/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("radio", { name: /kindPlacement/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("radio", { name: /kindExecution/ }),
		).toBeTruthy();
	});

	it("does not expose the v7 work/break/label kind buttons", () => {
		render(<QuickTileCreate />);
		expect(screen.queryByRole("button", { name: /kindTask/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /kindBreak/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /kindLabel/ })).toBeNull();
	});

	it("default kind is PLACEMENT (v1 numeric 1)", () => {
		render(<QuickTileCreate />);
		const placement = screen.getByRole("radio", { name: /kindPlacement/ });
		expect(placement.getAttribute("aria-checked")).toBe("true");
	});
});

describe("QuickTileCreate — §2 Plan", () => {
	it("role selector offers EXECUTABLE / LABEL", () => {
		render(<QuickTileCreate />);
		expect(
			screen.getByRole("radio", { name: /roleExecutable/ }),
		).toBeTruthy();
		expect(
			screen.getByRole("radio", { name: /roleLabel/ }),
		).toBeTruthy();
	});

	it("selecting LABEL sets plan.role=1 and meta.isLabelOnly=true", () => {
		render(<QuickTileCreate />);
		fireEvent.click(screen.getByRole("radio", { name: /roleLabel/ }));
		const state = useQuickCreateStore.getState();
		expect(state.plan.role).toBe(1);
		expect(state.meta.isLabelOnly).toBe(true);
	});

	it("completion / references / planning / metrics / decisions are stub rows with counts", () => {
		render(<QuickTileCreate />);
		expect(screen.getByText(/completionTitle/)).toBeTruthy();
		expect(screen.getByText(/referencesTitle/)).toBeTruthy();
		expect(screen.getByText(/planningTitle/)).toBeTruthy();
		expect(screen.getByText(/metricsTitle/)).toBeTruthy();
		expect(screen.getByText(/decisionsTitle/)).toBeTruthy();
	});
});

describe("QuickTileCreate — §3 Time", () => {
	it("schedule is a single inline pill that expands on click", () => {
		render(<QuickTileCreate />);
		const pill = screen.getByRole("button", { name: /scheduleTitle/ });
		expect(pill.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(pill);
		expect(pill.getAttribute("aria-expanded")).toBe("true");
		// After expansion, datetime-local inputs are visible
		expect(screen.getAllByLabelText(/startAt/).length).toBeGreaterThan(0);
		expect(screen.getAllByLabelText(/endAt/).length).toBeGreaterThan(0);
	});

	it("duration min/max inputs write to the store as number | null", () => {
		render(<QuickTileCreate />);
		const min = screen.getByRole("spinbutton", { name: /minMsLabel/ });
		const max = screen.getByRole("spinbutton", { name: /maxMsLabel/ });
		fireEvent.change(min, { target: { value: "1500000" } });
		fireEvent.change(max, { target: { value: "3600000" } });
		const state = useQuickCreateStore.getState();
		expect(state.time.durationMinMax.minMs).toBe(1500000);
		expect(state.time.durationMinMax.maxMs).toBe(3600000);
	});
});

describe("QuickTileCreate — §4 Windows", () => {
	it("renders an Add button when the section is empty", () => {
		render(<QuickTileCreate />);
		expect(
			screen.getByRole("button", { name: /windowsAdd/ }),
		).toBeTruthy();
		expect(screen.queryByTestId(/^window-row-/)).toBeNull();
	});

	it("Add creates a CALENDAR Window with empty bounds", () => {
		render(<QuickTileCreate />);
		fireEvent.click(screen.getByRole("button", { name: /windowsAdd/ }));
		const state = useQuickCreateStore.getState();
		expect(state.windows.length).toBe(1);
		const w = state.windows[0]!;
		expect(w.kind).toBe(0); // CALENDAR
		expect(w.bounds.start).toBe("");
		expect(w.bounds.end).toBe("");
		expect(w.referenceId).toBeNull();
		expect(w.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(screen.getByTestId("window-row-0")).toBeTruthy();
	});

	it("kind picker updates Window.kind (0..3) and reveals referenceId input for non-CALENDAR", () => {
		useQuickCreateStore.setState({
			windows: [
				{
					id: "w-1",
					owner: "self",
					kind: 0,
					bounds: { start: "", end: "" },
					rules: [],
					referenceId: null,
				},
			],
		});
		render(<QuickTileCreate />);
		// Switch to LABEL_SPAN (1)
		fireEvent.click(screen.getByRole("radio", { name: /windowKindLabelSpan/ }));
		const state = useQuickCreateStore.getState();
		expect(state.windows[0]!.kind).toBe(1);
		// referenceId input is now visible
		const refInput = screen.getByRole("textbox", {
			name: /windowReferenceIdLabel/,
		});
		fireEvent.change(refInput, { target: { value: "ref-uuid" } });
		expect(useQuickCreateStore.getState().windows[0]!.referenceId).toBe(
			"ref-uuid",
		);
	});

	it("Remove deletes a Window by index", () => {
		useQuickCreateStore.setState({
			windows: [
				{
					id: "w-1",
					owner: "self",
					kind: 0,
					bounds: { start: "", end: "" },
					rules: [],
					referenceId: null,
				},
				{
					id: "w-2",
					owner: "self",
					kind: 0,
					bounds: { start: "", end: "" },
					rules: [],
					referenceId: null,
				},
			],
		});
		render(<QuickTileCreate />);
		expect(screen.getByTestId("window-row-0")).toBeTruthy();
		expect(screen.getByTestId("window-row-1")).toBeTruthy();
		fireEvent.click(screen.getAllByLabelText(/windowRemove/)[0]!);
		const state = useQuickCreateStore.getState();
		expect(state.windows.length).toBe(1);
		expect(state.windows[0]!.id).toBe("w-2");
	});
});

describe("QuickTileCreate — §5 Recurring (conditional)", () => {
	it("is hidden when kind = PLACEMENT (default)", () => {
		render(<QuickTileCreate />);
		const headers = screen.getAllByTestId("section-header");
		const titles = headers.map((h) => h.textContent ?? "");
		expect(titles.some((t) => t.includes("§5 Recurring"))).toBe(false);
	});

	it("appears when kind is switched to RECURRING", () => {
		render(<QuickTileCreate />);
		fireEvent.click(screen.getByRole("radio", { name: /kindRecurring/ }));
		const headers = screen.getAllByTestId("section-header");
		const titles = headers.map((h) => h.textContent ?? "");
		expect(titles.some((t) => t.includes("§5 Recurring"))).toBe(true);
		// active start/end date inputs visible
		expect(screen.getByLabelText(/recurringActiveStart/)).toBeTruthy();
		expect(screen.getByLabelText(/recurringActiveEnd/)).toBeTruthy();
	});

	it("renders an Add frame rule button when there are no rules", () => {
		useQuickCreateStore.setState({
			identity: {
				...useQuickCreateStore.getState().identity,
				kind: 0, // RECURRING
			},
		});
		render(<QuickTileCreate />);
		expect(
			screen.getByRole("button", { name: /frameRulesAdd/ }),
		).toBeTruthy();
		expect(screen.queryByTestId(/^frame-rule-row-/)).toBeNull();
	});

	it("Add creates a Step FrameRule with default values", () => {
		useQuickCreateStore.setState({
			identity: {
				...useQuickCreateStore.getState().identity,
				kind: 0, // RECURRING
			},
		});
		render(<QuickTileCreate />);
		fireEvent.click(screen.getByRole("button", { name: /frameRulesAdd/ }));
		const state = useQuickCreateStore.getState();
		expect(state.recurring.frameRules.length).toBe(1);
		const rule = state.recurring.frameRules[0]!;
		expect(rule.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(rule.generator.kind).toBe("step");
		if (rule.generator.kind === "step") {
			expect(rule.generator.value.step).toBe(0);
		}
		expect(screen.getByTestId("frame-rule-row-0")).toBeTruthy();
	});

	it("kind picker switches generator.kind and resets value to new defaults", () => {
		useQuickCreateStore.setState({
			identity: {
				...useQuickCreateStore.getState().identity,
				kind: 0, // RECURRING
			},
			recurring: {
				...useQuickCreateStore.getState().recurring,
				frameRules: [
					{
						id: "fr-1",
						generator: {
							kind: "step",
							value: { step: 5000, origin: null, bounds: null },
						},
						active: null,
					},
				],
			},
		});
		render(<QuickTileCreate />);
		// Switch to Calendar
		fireEvent.click(
			screen.getByRole("radio", { name: /frameRuleKindCalendar/ }),
		);
		const rule = useQuickCreateStore.getState().recurring.frameRules[0]!;
		expect(rule.generator.kind).toBe("calendar");
		if (rule.generator.kind === "calendar") {
			expect(rule.generator.value.unit).toBe(0);
			expect(rule.generator.value.holidayKind).toBe(2);
		}
		// And back to Reference
		fireEvent.click(
			screen.getByRole("radio", { name: /frameRuleKindReference/ }),
		);
		const refRule = useQuickCreateStore.getState().recurring.frameRules[0]!;
		expect(refRule.generator.kind).toBe("reference");
		if (refRule.generator.kind === "reference") {
			expect(refRule.generator.value.align).toBe(0);
		}
	});

	it("Remove deletes a FrameRule by index", () => {
		useQuickCreateStore.setState({
			identity: {
				...useQuickCreateStore.getState().identity,
				kind: 0, // RECURRING
			},
			recurring: {
				...useQuickCreateStore.getState().recurring,
				frameRules: [
					{
						id: "fr-1",
						generator: {
							kind: "step",
							value: { step: 0, origin: null, bounds: null },
						},
						active: null,
					},
					{
						id: "fr-2",
						generator: {
							kind: "reference",
							value: { referenceId: "ref-x", align: 0 },
						},
						active: null,
					},
				],
			},
		});
		render(<QuickTileCreate />);
		expect(screen.getByTestId("frame-rule-row-0")).toBeTruthy();
		expect(screen.getByTestId("frame-rule-row-1")).toBeTruthy();
		fireEvent.click(screen.getAllByLabelText(/frameRuleRemove/)[0]!);
		const state = useQuickCreateStore.getState();
		expect(state.recurring.frameRules.length).toBe(1);
		expect(state.recurring.frameRules[0]!.id).toBe("fr-2");
	});
});

describe("QuickTileCreate — §7 Meta", () => {
	it("project input writes to meta.project", () => {
		render(<QuickTileCreate />);
		const project = screen.getByRole("textbox", {
			name: /projectPlaceholder/,
		});
		fireEvent.change(project, { target: { value: "Atlas" } });
		expect(useQuickCreateStore.getState().meta.project).toBe("Atlas");
	});

	it("tag input adds a chip on Enter", () => {
		render(<QuickTileCreate />);
		const tagInput = screen.getByRole("textbox", { name: /tagsPlaceholder/ });
		fireEvent.change(tagInput, { target: { value: "focus" } });
		fireEvent.keyDown(tagInput, { key: "Enter" });
		expect(screen.getByText("#focus")).toBeTruthy();
		expect(useQuickCreateStore.getState().meta.tags).toContain("focus");
	});

	it("memo is collapsed by default and expands on click", () => {
		render(<QuickTileCreate />);
		expect(
			screen.queryByRole("textbox", { name: /memoPlaceholder/ }),
		).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /memoPlaceholder/ }));
		expect(
			screen.getByRole("textbox", { name: /memoPlaceholder/ }),
		).toBeTruthy();
	});
});

describe("QuickTileCreate — submit", () => {
	it("fires submitCreateTile with the v1 client on valid submit", async () => {
		render(<QuickTileCreate />);

		fireEvent.change(
			screen.getByRole("textbox", { name: /titlePlaceholder/ }),
			{ target: { value: "Smoke test" } },
		);
		fireEvent.click(screen.getByRole("button", { name: /commit/ }));

		await waitFor(() => expect(submitMock).toHaveBeenCalled());
		const arg = submitMock.mock.calls[0]?.[0];
		expect(arg).toBeDefined();
		expect(arg.client).toBeDefined();
		expect(typeof arg.client.getIdToken).toBe("function");
	});

	it("surfaces a role=alert when the title is empty", async () => {
		render(<QuickTileCreate />);
		// Title is empty by default — auto-suggestion would have populated it,
		// but in this test the store is reset and the suggestion runs only on
		// mount. Clear the title (if any) and force an empty state.
		fireEvent.change(
			screen.getByRole("textbox", { name: /titlePlaceholder/ }),
			{ target: { value: "" } },
		);
		fireEvent.click(screen.getByRole("button", { name: /commit/ }));
		await waitFor(() => {
			expect(screen.queryByRole("alert")).toBeTruthy();
		});
		// submit must NOT have been called when the form is invalid
		expect(submitMock).not.toHaveBeenCalled();
	});

	it("does not call submit when store-side validation fails (e.g. span inverted)", async () => {
		useQuickCreateStore.setState({
			time: {
				span: { start: "2026-12-01T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
				durationMinMax: { minMs: null, maxMs: null },
				whenMode: "none",
				timeOfDayMode: "unspecified",
				timeOfDayStart: "",
				timeOfDayEnd: "",
				referenceId: null,
				referenceLabel: "",
			},
			identity: { ...useQuickCreateStore.getState().identity, title: "Inverted" },
		});
		render(<QuickTileCreate />);
		fireEvent.click(screen.getByRole("button", { name: /commit/ }));
		await waitFor(() => {
			expect(screen.queryByRole("alert")).toBeTruthy();
		});
		expect(submitMock).not.toHaveBeenCalled();
	});

	it("does not show any sub-panel navigation buttons", () => {
		render(<QuickTileCreate />);
		// v1 構造エディタ has no sub-panel nav. The old v7 sub-panel titles
		// must not appear.
		expect(
			screen.queryByRole("button", { name: /recurrenceNavTitle/ }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: /interruptNavTitle/ }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: /automationNavTitle/ }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: /metaNavTitle/ }),
		).toBeNull();
	});

	it("does not expose v7 doneRule / interrupt / automation switches", () => {
		render(<QuickTileCreate />);
		expect(screen.queryByRole("radio", { name: /doneRuleManual/ })).toBeNull();
		expect(screen.queryByRole("radio", { name: /doneRuleTimeReached/ })).toBeNull();
		expect(screen.queryByRole("radio", { name: /doneRuleIntervalEnd/ })).toBeNull();
		expect(
			screen.queryByRole("switch", { name: /externalInterruptOnlyTitle/ }),
		).toBeNull();
		expect(screen.queryByRole("switch", { name: /promptOnStartTitle/ })).toBeNull();
		expect(screen.queryByRole("switch", { name: /autoStartAllowedTitle/ })).toBeNull();
	});

	it("closes the panel and resets the store on successful submit", async () => {
		render(<QuickTileCreate />);
		fireEvent.change(
			screen.getByRole("textbox", { name: /titlePlaceholder/ }),
			{ target: { value: "Done" } },
		);
		fireEvent.click(screen.getByRole("button", { name: /commit/ }));
		await waitFor(() => expect(submitMock).toHaveBeenCalled());
		// reset() copies the default state and re-sets isOpen to its current
		// value; close() then sets isOpen to false.
		await waitFor(() => {
			expect(useQuickCreateStore.getState().isOpen).toBe(false);
		});
		expect(useQuickCreateStore.getState().identity.title).toBe("");
	});
});
