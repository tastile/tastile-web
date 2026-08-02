import { describe, expect, it } from "vitest";
import {
	getEnabled,
	SECURITY_LOCK_ENABLED_KEY,
	shouldRequireUnlock,
} from "./security-lock-policy";

function createMemoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key: string) => map.get(key) ?? null,
		key: (index: number) => Array.from(map.keys())[index] ?? null,
		removeItem: (key: string) => {
			map.delete(key);
		},
		setItem: (key: string, value: string) => {
			map.set(key, String(value));
		},
	} as Storage;
}

describe("getEnabled (default OFF)", () => {
	it("returns false when the key is unset (default off)", () => {
		const storage = createMemoryStorage();
		expect(getEnabled(storage)).toBe(false);
	});

	it("returns true when the user explicitly opted in (stored \"true\")", () => {
		const storage = createMemoryStorage();
		storage.setItem(SECURITY_LOCK_ENABLED_KEY, "true");
		expect(getEnabled(storage)).toBe(true);
	});

	it("returns false when the user explicitly opted out (stored \"false\")", () => {
		const storage = createMemoryStorage();
		storage.setItem(SECURITY_LOCK_ENABLED_KEY, "false");
		expect(getEnabled(storage)).toBe(false);
	});

	it("returns false for any non-true value (treats legacy / unexpected values as off)", () => {
		const storage = createMemoryStorage();
		storage.setItem(SECURITY_LOCK_ENABLED_KEY, "1");
		expect(getEnabled(storage)).toBe(false);
	});
});

describe("shouldRequireUnlock", () => {
	it("requires unlock when elapsed time is past timeout", () => {
		expect(
			shouldRequireUnlock({
				enabled: true,
				timeoutMinutes: 10,
				lastLeftAt: 1_000,
				now: 601_000,
			}),
		).toBe(true);
	});

	it("skips when disabled", () => {
		expect(
			shouldRequireUnlock({
				enabled: false,
				timeoutMinutes: 10,
				lastLeftAt: 1_000,
				now: 601_000,
			}),
		).toBe(false);
	});
});
