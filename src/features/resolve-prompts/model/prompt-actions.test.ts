import { PromptKind, PromptResolution, type PromptSubject, type PromptView } from "@/shared/api/v1/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionsFor, runPromptAction } from "./prompt-actions";

const calls: string[] = [];
const ok = { ok: true as const, data: {}, status: 200 };
const failure = { ok: false as const, error: { kind: 0, message: "stale revision" } };
let startResult: typeof ok | typeof failure = ok;

vi.mock("@/shared/api/v1/prompts", async (actual) => ({
  ...(await actual<typeof import("@/shared/api/v1/prompts")>()),
  resolvePromptCommand: vi.fn(async (o: { promptId: string; resolution: number }) => {
    calls.push(`resolve:${o.promptId}:${o.resolution}`);
    return ok;
  }),
}));
vi.mock("@/shared/api/v1/tile-commands", () => ({
  startExecutionCommand: vi.fn(async (o: { placementId: string }) => {
    calls.push(`start:${o.placementId}`);
    return startResult;
  }),
  finishExecutionCommand: vi.fn(async (o: { executionId: string }) => {
    calls.push(`finish:${o.executionId}`);
    return ok;
  }),
}));
vi.mock("@/shared/api/v1/source-tiles", () => ({
  getSourceTile: vi.fn(async () => ({ ok: true, status: 200, data: { source: { revision: 7 } } })),
  reflowSourceTile: vi.fn(
    async (o: { sourceTileId: string; expectedRevision: number; range: { start: string; end: string } }) => {
      calls.push(`reflow:${o.sourceTileId}:${o.expectedRevision}:${o.range.start}:${o.range.end}`);
      return ok;
    },
  ),
}));

const client = { baseUrl: "http://core", getIdToken: async () => "t" };
const prompt = (kind: number): PromptView => ({
  id: "p1",
  kind,
  subject: { kind: 1, id: "pl1" },
  note: null,
  created_at: "2026-10-19T00:00:00Z",
  expires_at: null,
});
const subject = (over: Partial<PromptSubject> = {}): PromptSubject => ({
  title: "Write",
  placementId: "pl1",
  executionId: null,
  sourceTileId: "s1",
  spanStart: null,
  spanEnd: null,
  ...over,
});

beforeEach(() => {
  calls.length = 0;
  startResult = ok;
});

describe("actionsFor", () => {
  it("offers start, reschedule and dismiss for a missed start", () => {
    expect(actionsFor(prompt(PromptKind.MISSED_START), subject())).toEqual(["startNow", "reschedule", "dismiss"]);
  });

  it("drops reschedule when the placement has no source", () => {
    expect(actionsFor(prompt(PromptKind.MISSED_START), subject({ sourceTileId: null }))).toEqual([
      "startNow",
      "dismiss",
    ]);
  });

  it("offers finish and keep going for a stale active execution", () => {
    expect(actionsFor(prompt(PromptKind.STALE_ACTIVE_EXECUTION), subject({ executionId: "e1" }))).toEqual([
      "finish",
      "keepGoing",
    ]);
  });

  it("falls back to acknowledge and dismiss", () => {
    expect(actionsFor(prompt(PromptKind.DECISION_REQUIRED), subject())).toEqual(["acknowledge", "dismiss"]);
  });
});

describe("runPromptAction", () => {
  it("starts the placement, then resolves as action taken", async () => {
    const outcome = await runPromptAction(client, prompt(PromptKind.MISSED_START), subject(), "startNow");
    expect(outcome).toEqual({ ok: true });
    expect(calls).toEqual(["start:pl1", `resolve:p1:${PromptResolution.ACTION_TAKEN}`]);
  });

  it("leaves the prompt pending when the command fails", async () => {
    startResult = failure;
    const outcome = await runPromptAction(client, prompt(PromptKind.MISSED_START), subject(), "startNow");
    expect(outcome).toEqual({ ok: false, message: "stale revision" });
    expect(calls).toEqual(["start:pl1"]);
  });

  it("reflows the source from now at its current revision", async () => {
    const now = new Date("2026-10-19T10:00:00Z");
    await runPromptAction(client, prompt(PromptKind.MISSED_START), subject(), "reschedule", now);
    expect(calls).toEqual([
      "reflow:s1:7:2026-10-19T10:00:00.000Z:2026-10-26T10:00:00.000Z",
      `resolve:p1:${PromptResolution.ACTION_TAKEN}`,
    ]);
  });

  it("finishes a stale execution", async () => {
    await runPromptAction(client, prompt(PromptKind.STALE_ACTIVE_EXECUTION), subject({ executionId: "e1" }), "finish");
    expect(calls).toEqual(["finish:e1", `resolve:p1:${PromptResolution.ACTION_TAKEN}`]);
  });

  it("maps keep going and dismiss to their resolutions without commands", async () => {
    await runPromptAction(client, prompt(PromptKind.STALE_ACTIVE_EXECUTION), subject(), "keepGoing");
    await runPromptAction(client, prompt(PromptKind.MISSED_START), subject(), "dismiss");
    expect(calls).toEqual([
      `resolve:p1:${PromptResolution.ACKNOWLEDGED}`,
      `resolve:p1:${PromptResolution.DISMISSED}`,
    ]);
  });
});
