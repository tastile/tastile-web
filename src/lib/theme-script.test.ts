import { describe, expect, it } from "vitest";
import { resolveInitialThemeMode } from "@/lib/theme-script";

describe("resolveInitialThemeMode", () => {
	it("prefers new theme-mode storage over legacy store", () => {
		const mode = resolveInitialThemeMode(
			"dark-black",
			JSON.stringify({ state: { theme: "light" } }),
			false,
		);
		expect(mode).toBe("dark-black");
	});

	it("maps legacy persisted theme to current mode", () => {
		const mode = resolveInitialThemeMode(
			null,
			JSON.stringify({ state: { theme: "gray" } }),
			false,
		);
		expect(mode).toBe("dark-gray");
	});

	it("falls back to system preference when no storage exists", () => {
		expect(resolveInitialThemeMode(null, null, true)).toBe("dark-gray");
		expect(resolveInitialThemeMode(null, null, false)).toBe("light");
	});
});
