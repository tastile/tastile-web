// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/render-with-mantine";
import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { V2ScheduleEval } from "./V2ScheduleEval";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function primeRecurringSchedule() {
  useQuickCreateStore.setState((prev) => ({
    recurring: {
      ...prev.recurring,
      repeatMode: "daily",
      intervalValue: 1,
      intervalUnit: "day",
      life: {
        ...prev.recurring.life,
        active: { startDate: "", endDate: "" },
      },
      endDate: "",
    },
    time: {
      ...prev.time,
      whenMode: "day",
      span: { start: "", end: "" },
      durationMinMax: { minMs: 1_800_000, maxMs: 1_800_000 },
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
    },
    windows: [],
    plan: {
      ...prev.plan,
      completion: {
        ...prev.plan.completion,
        timeRequirements: prev.plan.completion.timeRequirements.map((r) => ({
          ...r,
          required: { minMs: null, maxMs: null },
        })),
      },
    },
  }));
}

async function enableOptIn() {
  fireEvent.click(screen.getByTestId("v2-eval-optin"));
  await screen.findByTestId("v2-eval-run");
}

describe("V2ScheduleEval", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useLocaleStore.setState({ locale: "en" });
    primeRecurringSchedule();
  });

  it("renders nothing for non-recurring schedules", () => {
    useQuickCreateStore.setState((prev) => ({
      recurring: { ...prev.recurring, repeatMode: "once" },
    }));
    renderWithMantine(<V2ScheduleEval />);
    expect(screen.queryByTestId("v2-eval-optin")).not.toBeInTheDocument();
    expect(screen.queryByText(/v2 engine evaluation/)).not.toBeInTheDocument();
  });

  it("does not call the v2 endpoint while opt-in is off", () => {
    renderWithMantine(<V2ScheduleEval />);
    expect(screen.queryByTestId("v2-eval-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("v2-eval-run")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the missing-duration hint instead of a run button", () => {
    useQuickCreateStore.setState((prev) => ({
      time: {
        ...prev.time,
        durationMinMax: { minMs: null, maxMs: null },
      },
      plan: {
        ...prev.plan,
        completion: {
          ...prev.plan.completion,
          timeRequirements: prev.plan.completion.timeRequirements.map((r) => ({
            ...r,
            required: { minMs: null, maxMs: null },
          })),
        },
      },
    }));
    renderWithMantine(<V2ScheduleEval />);
    enableOptIn();
    expect(
      screen.getByText(/Set a duration to use v2 evaluation/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("v2-eval-run")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts opt_in input and renders v2 candidates", async () => {
    const start = Date.now() + 86_400_000;
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        engine: "v2",
        ok: true,
        occurrences: [
          [start, start + 1_800_000],
          [start + 86_400_000, start + 86_400_000 + 1_800_000],
        ],
        count: 2,
        diagnostics: {},
      }),
    );
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v2/scheduler/evaluate");
    const body = JSON.parse(String(init.body)) as {
      opt_in: boolean;
      input: { step_ms: number; span_ms: number };
    };
    expect(body.opt_in).toBe(true);
    expect(body.input.step_ms).toBe(86_400_000);
    expect(body.input.span_ms).toBe(1_800_000);

    await screen.findByTestId("v2-eval-result");
    expect(screen.getByText(/2 candidates/)).toBeInTheDocument();
    expect(screen.getByTestId("v2-eval-adopt")).toBeInTheDocument();
    expect(screen.getByTestId("v2-eval-discard")).toBeInTheDocument();
  });

  it("adopt mirrors the first candidate time-of-day into v1 fields", async () => {
    const start = Date.now() + 86_400_000;
    const end = start + 1_800_000;
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        engine: "v2",
        ok: true,
        occurrences: [[start, end]],
        count: 1,
        diagnostics: {},
      }),
    );
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));
    await screen.findByTestId("v2-eval-adopt");
    fireEvent.click(screen.getByTestId("v2-eval-adopt"));

    const time = useQuickCreateStore.getState().time;
    const s = new Date(start);
    const e = new Date(end);
    const hhmm = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    expect(time.timeOfDayMode).toBe("range");
    expect(time.schedulableWindow.start).toBe(hhmm(s));
    expect(time.schedulableWindow.end).toBe(hhmm(e));
    expect(time.timeOfDayStart).toBe(hhmm(s));
    expect(time.timeOfDayEnd).toBe(hhmm(e));
    expect(screen.getByTestId("v2-eval-adopted")).toBeInTheDocument();
    expect(screen.queryByTestId("v2-eval-result")).not.toBeInTheDocument();
  });

  it("discard closes the preview without touching schedule fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        engine: "v2",
        ok: true,
        occurrences: [[1, 2]],
        count: 1,
        diagnostics: {},
      }),
    );
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));
    await screen.findByTestId("v2-eval-discard");
    fireEvent.click(screen.getByTestId("v2-eval-discard"));

    expect(screen.queryByTestId("v2-eval-result")).not.toBeInTheDocument();
    const time = useQuickCreateStore.getState().time;
    expect(time.timeOfDayMode).toBe("unspecified");
    expect(time.timeOfDayStart).toBe("");
    expect(time.timeOfDayEnd).toBe("");
  });

  it("renders the typed fallback result without touching v1 state", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        engine: "fallback",
        ok: false,
        fallback_reason: "v2_timeout",
      }),
    );
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));

    await screen.findByTestId("v2-eval-result");
    expect(screen.getByText(/v2_timeout/)).toBeInTheDocument();
    expect(screen.queryByTestId("v2-eval-adopt")).not.toBeInTheDocument();
  });

  it("renders the disabled result", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { engine: "disabled" }));
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));

    await screen.findByTestId("v2-eval-result");
    expect(screen.getByText(/currently disabled/)).toBeInTheDocument();
  });

  it("renders a typed v2 failure", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        engine: "v2",
        ok: false,
        error: { code: "out_of_fuel", message: "fuel exhausted" },
      }),
    );
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));

    await screen.findByTestId("v2-eval-result");
    expect(screen.getByText(/out_of_fuel/)).toBeInTheDocument();
    expect(screen.queryByTestId("v2-eval-adopt")).not.toBeInTheDocument();
  });

  it("surfaces HTTP failures as a request error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
    renderWithMantine(<V2ScheduleEval />);
    await enableOptIn();
    fireEvent.click(screen.getByTestId("v2-eval-run"));

    await screen.findByTestId("v2-eval-error");
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument();
  });
});
