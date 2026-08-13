/** @vitest-environment jsdom */

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TileId } from "@/shared/model/ids";
import { Tile } from "@/tile/model/types";
import { renderWithMantine } from "@/test/render-with-mantine";
import { RightSidebar } from "./RightSidebar";

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

describe("RightSidebar", () => {
	it("uses status icon controls and does not render start buttons in next tile area", () => {
		const nextTile = Tile.create(
			TileId.fromString("2d8e4a4d-6cd1-4fdf-8f1f-876a23fbe4f8"),
			"Deep work",
		);
		const quickTile = Tile.create(
			TileId.fromString("1936754e-d745-48a0-a11a-0a1f3d52fc5f"),
			"Review",
		);
		const onPromptSuggested = vi.fn();

		renderWithMantine(
			<RightSidebar
				nextTile={nextTile}
				nextQuickTiles={[quickTile]}
				onPromptSuggested={onPromptSuggested}
				timelineItems={[]}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "tiles.actions.start" }),
		).toBeNull();
		const statusButtons = screen.getAllByRole("button", { name: /Status:/ });
		fireEvent.click(statusButtons[0]);
		expect(onPromptSuggested).toHaveBeenCalledWith(nextTile.core.id);
	});
});
