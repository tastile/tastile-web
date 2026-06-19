import { describe, expect, it, vi } from "vitest";
import { TileId } from "../domain/ids";
import { DaemonClient } from "./client";

describe("DaemonClient", () => {
	it("does not throw illegal invocation when using global fetch reference", async () => {
		const originalFetch = globalThis.fetch;
		const fakeFetch = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					in_progress_tiles: [],
					prompt_queue: [],
					timeline: [],
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});

		globalThis.fetch = fakeFetch as unknown as typeof fetch;
		try {
			const client = new DaemonClient({
				baseUrl: "https://daemon.example",
			});
			const snapshot = await client.readSnapshot();
			expect(snapshot.timeline).toEqual([]);
			expect(fakeFetch).toHaveBeenCalledTimes(1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("reads snapshot with auth header", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					in_progress_tiles: [],
					prompt_queue: [],
					timeline: [],
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
			getAccessToken: async () => "access-token-1",
		});

		const snapshot = await client.readSnapshot();

		expect(snapshot).toEqual({
			inProgressTiles: [],
			promptQueue: [],
			timeline: [],
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/execution/snapshot",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					authorization: "Bearer access-token-1",
				}),
			}),
		);
	});

	it("reads desktop parity read models", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						tiles: [
							{
								id: "tile-1",
								title: "Write spec",
								lifecycle: "ready",
								target_work_min: 30,
								target_rest_min: 5,
								semantic_role: "work",
								labels: ["project:core"],
							},
						],
						next_actionable_tile_id: "tile-1",
						next_actionable_start_at: null,
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						tiles_in_progress: [],
						main_tile: null,
						is_working: false,
						is_on_break: false,
						is_idle: true,
						main_tile_started_at: null,
						main_tile_ends_at: null,
						pending_prompt_id: null,
						tile_count: 1,
						event_count: 0,
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						prompt: {
							prompt_id: "prompt-1",
							kind: "start_tile",
							severity: "soft",
							tile_id: "tile-1",
							title: "Start tile",
							body: "Do next action",
							why: "best candidate",
							suggested_minutes: 25,
							reasons: ["resume_in_flight"],
							actions: [{ id: "start_tile", label: "Start" }],
							created_at: "2026-04-06T10:00:00.000Z",
							expires_at: null,
							stale: false,
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								kind: "work",
								tile_id: "tile-1",
								semantic_role: "work",
								title: "Write spec",
								started_at: "2026-04-06T10:00:00.000Z",
								ended_at: null,
								duration_min: 10,
								is_active: true,
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			);
		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const tiles = await client.readTiles({
			viewMode: "list",
			lifecycle: "ready",
			limit: 8,
			search: "write",
		});
		const executionView = await client.readExecutionView();
		const pendingPrompt = await client.readPendingPrompt();
		const timeline = await client.readTodayTimeline();

		expect(tiles.tiles[0].targetWorkMin).toBe(30);
		expect(executionView.tileCount).toBe(1);
		expect(pendingPrompt.prompt?.actions[0]).toEqual({
			id: "start_tile",
			label: "Start",
		});
		expect(timeline.items[0].isActive).toBe(true);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			1,
			"https://daemon.example/read/tiles?view_mode=list&lifecycle=ready&limit=8&search=write",
			expect.objectContaining({ method: "GET" }),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			2,
			"https://daemon.example/read/execution-view",
			expect.objectContaining({ method: "GET" }),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			3,
			"https://daemon.example/views/pending-prompt",
			expect.objectContaining({ method: "GET" }),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			4,
			"https://daemon.example/views/timeline/today",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("accepts pending prompt with null severity by defaulting to soft", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					prompt: {
						prompt_id: "prompt-null-severity",
						kind: "start_tile",
						severity: null,
						tile_id: "tile-1",
						title: "Start",
						body: "Go",
						why: "ranked",
						suggested_minutes: null,
						reasons: [],
						actions: ["start_tile"],
						created_at: null,
						expires_at: null,
						stale: false,
					},
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});
		const prompt = await client.readPendingPrompt();
		expect(prompt.prompt?.severity).toBe("soft");
	});

	it("sends command with auth header and receives accepted envelope", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					accepted: true,
					command_id: "cmd-1",
					request_id: "req-1",
				}),
				{
					status: 202,
					headers: { "content-type": "application/json" },
				},
			);
		});

		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
			getAccessToken: async () => "access-token-1",
		});

		const result = await client.sendCommand({
			type: "start_tile",
			tileId: TileId.fromString("tile-1"),
			startedAt: new Date("2026-03-26T09:00:00.000Z"),
			source: "manual",
		});

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/commands/tile/start",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ tile_id: "tile-1" }),
				headers: expect.objectContaining({
					authorization: "Bearer access-token-1",
					"content-type": "application/json",
				}),
			}),
		);
		expect(result).toEqual({
			accepted: true,
			commandId: "cmd-1",
			requestId: "req-1",
		});
	});

	it("restores daemon session from legacy session payload", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					user_id: "user-1",
					email: "user@example.com",
					access_token: "access-token-1",
					refresh_token: "refresh-token-1",
					expires_at: "2026-03-28T14:00:00.000Z",
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});

		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		await client.restoreSession({
			userId: "user-1",
			email: "user@example.com",
			accessToken: "access-token-1",
			refreshToken: "refresh-token-1",
			expiresAt: "2026-03-28T14:00:00.000Z",
		});

		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/auth/session/restore",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"content-type": "application/json",
				}),
				body: JSON.stringify({
					user_id: "user-1",
					email: "user@example.com",
					access_token: "access-token-1",
					refresh_token: "refresh-token-1",
					expires_at: "2026-03-28T14:00:00.000Z",
				}),
			}),
		);
	});

	it("gets integration settings for google calendar", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					google_calendar: {
						connected: true,
						can_read: true,
						can_write: true,
						account_email: "user@example.com",
						last_synced_at: "2026-03-30T04:00:00.000Z",
					},
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const settings = await client.getIntegrationSettings();
		expect(settings.connected).toBe(true);
		expect(settings.accountEmail).toBe("user@example.com");
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/auth/integrations/settings",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("updates google calendar integration settings", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					google_calendar: {
						connected: false,
						can_read: true,
						can_write: true,
						account_email: null,
						last_synced_at: null,
					},
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const settings = await client.updateGoogleCalendarIntegration({
			connected: false,
			accountEmail: null,
			lastSyncedAt: null,
		});
		expect(settings.connected).toBe(false);
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/auth/integrations/settings",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					google_calendar: {
						connected: false,
						account_email: null,
						last_synced_at: null,
					},
				}),
			}),
		);
	});

	it("reads daemon sync status", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					in_progress: false,
					last_attempt_at: "2026-04-04T00:00:00.000Z",
					last_success_at: "2026-04-04T00:00:01.000Z",
					last_error: null,
					last_result: {
						uploaded: 1,
						downloaded: 2,
						applied: 2,
						failed: 0,
						conflicts: 0,
					},
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});

		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const status = await client.readSyncStatus();
		expect(status.inProgress).toBe(false);
		expect(status.lastResult?.downloaded).toBe(2);
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://daemon.example/sync/status",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("reads daemon sync status when optional fields are missing", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					in_progress: true,
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});

		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const status = await client.readSyncStatus();
		expect(status).toEqual({
			inProgress: true,
			lastAttemptAt: null,
			lastSuccessAt: null,
			lastError: null,
			lastResult: null,
		});
	});

	it("normalizes malformed daemon sync counters to finite integers", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					in_progress: false,
					last_attempt_at: null,
					last_success_at: null,
					last_error: null,
					last_result: {
						uploaded: "x",
						downloaded: 3.9,
						applied: -2,
						failed: Infinity,
						conflicts: null,
					},
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});

		const client = new DaemonClient({
			baseUrl: "https://daemon.example",
			fetchImpl,
		});

		const status = await client.readSyncStatus();
		expect(status.lastResult).toEqual({
			uploaded: 0,
			downloaded: 3,
			applied: 0,
			failed: 0,
			conflicts: 0,
		});
	});
});
