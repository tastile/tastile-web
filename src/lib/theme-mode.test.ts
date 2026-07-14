// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyThemeMode } from "@/lib/theme-mode";

const storage = new Map<string, string>();

beforeEach(() => {
	storage.clear();

	// jsdom's default localStorage stub has no body; replace it with a
	// Map-backed implementation so the source under test can read/write.
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		writable: true,
		value: {
			getItem: (key: string) => (storage.has(key) ? (storage.get(key) as string) : null),
			setItem: (key: string, value: string) => {
				storage.set(key, String(value));
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => storage.clear(),
			key: (i: number) => Array.from(storage.keys())[i] ?? null,
			get length() {
				return storage.size;
			},
		},
	});
});

afterEach(() => {
	document.documentElement.removeAttribute("data-mantine-color-scheme");
	document.documentElement.className = "";
});

describe("applyThemeMode", () => {
	it("light mode keeps Mantine scheme in sync", () => {
		applyThemeMode("light");

		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
		expect(storage.get("mantine-color-scheme-value")).toBe("light");
		expect(storage.get("theme-mode")).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("dark-gray mode flips Mantine scheme to dark", () => {
		applyThemeMode("dark-gray");

		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");
		expect(storage.get("mantine-color-scheme-value")).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("theme-dark-gray")).toBe(true);
	});

	it("dark-black mode flips Mantine scheme to dark", () => {
		applyThemeMode("dark-black");

		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark");
		expect(storage.get("mantine-color-scheme-value")).toBe("dark");
		expect(document.documentElement.classList.contains("theme-dark-black")).toBe(true);
	});

	it("switching back to light clears both class and Mantine scheme", () => {
		applyThemeMode("dark-gray");
		applyThemeMode("light");

		expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
		expect(storage.get("mantine-color-scheme-value")).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});
});
