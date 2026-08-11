/** @vitest-environment jsdom */

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import { ActivityBar } from "./ActivityBar";

let pathname = "/dashboard/tasks";

vi.mock("next/navigation", () => ({
	usePathname: () => pathname,
}));

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const ALL_ITEMS = [
	"nav.timeline",
	"nav.tasks",
	"nav.projects",
	"nav.schedule",
	"nav.preferences",
] as const;

function activeLabels(): string[] {
	return ALL_ITEMS.filter(
		(key) => screen.getByRole("link", { name: key }).dataset.active === "true",
	);
}

describe("ActivityBar", () => {
	beforeEach(() => {
		pathname = "/dashboard/tasks";
	});

	// The selected-item highlight is driven by `.activity-item[data-active]` in
	// globals.css, not by Tailwind classes: these are Mantine <Button>s and
	// Mantine ships its CSS unlayered, which outranks `@layer utilities`. These
	// assertions pin the hook the stylesheet selects on.
	it("marks exactly the current route's item as active", () => {
		renderWithMantine(<ActivityBar />);

		expect(activeLabels()).toEqual(["nav.tasks"]);

		const active = screen.getByRole("link", { name: "nav.tasks" });
		expect(active.getAttribute("aria-current")).toBe("page");
		expect(active.className).toContain("activity-item");

		const inactive = screen.getByRole("link", { name: "nav.timeline" });
		expect(inactive.getAttribute("aria-current")).toBeNull();
		expect(inactive.className).toContain("activity-item");
	});

	it("keeps the parent item active on nested routes", () => {
		pathname = "/dashboard/timeline/day";
		renderWithMantine(<ActivityBar />);

		expect(activeLabels()).toEqual(["nav.timeline"]);
	});

	it("does not activate an item on a merely prefix-similar path", () => {
		pathname = "/dashboard/tasks-archive";
		renderWithMantine(<ActivityBar />);

		expect(activeLabels()).toEqual([]);
	});
});
