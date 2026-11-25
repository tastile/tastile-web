/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine as render } from "@/test/render-with-mantine";

const listMock = vi.fn();
const runMock = vi.fn();

vi.mock("@/shared/api/v1/prompts", async (actual) => ({
  ...(await actual<typeof import("@/shared/api/v1/prompts")>()),
  listPendingPrompts: (...args: unknown[]) => listMock(...args),
  describePromptSubject: async (_client: unknown, prompt: { id: string }) => ({
    title: `Tile ${prompt.id}`,
    placementId: `pl-${prompt.id}`,
    executionId: null,
    sourceTileId: null,
    spanStart: "2026-10-19T01:30:00Z",
    spanEnd: null,
  }),
}));

vi.mock("../model/prompt-actions", async (actual) => ({
  ...(await actual<typeof import("../model/prompt-actions")>()),
  runPromptAction: (...args: unknown[]) => runMock(...args),
}));

vi.mock("@/shared/api/v1/submit", () => ({
  makeClient: () => ({ baseUrl: "/api/proxy", useProxyBridge: true, getIdToken: async () => null }),
}));

vi.mock("@/shared/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, number>) => (params ? `${key}:${params.count}` : key),
    locale: "en",
  }),
}));

import { PromptCenter } from "./PromptCenter";

const prompt = (id: string) => ({
  id,
  kind: 1,
  subject: { kind: 1, id: `pl-${id}` },
  note: null,
  created_at: "2026-10-19T00:00:00Z",
  expires_at: null,
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PromptCenter />
    </QueryClientProvider>,
  );
}

describe("PromptCenter", () => {
  it("renders nothing without pending prompts", async () => {
    listMock.mockResolvedValue({ ok: true, status: 200, data: [] });
    mount();
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.queryByTestId("prompt-card")).toBeNull();
  });

  it("shows three cards with their planned time and counts the rest", async () => {
    listMock.mockResolvedValue({ ok: true, status: 200, data: ["a", "b", "c", "d", "e"].map(prompt) });
    mount();
    await waitFor(() => expect(screen.getAllByTestId("prompt-card")).toHaveLength(3));
    expect(screen.getByText("Tile a")).toBeTruthy();
    expect(screen.queryByText("Tile d")).toBeNull();
    expect(screen.getByText("promptCenter.more:2")).toBeTruthy();
    expect(screen.getAllByTestId("prompt-card")[0].textContent).toContain("10/19");
  });

  it("refreshes after an action and flags a failed one", async () => {
    listMock.mockResolvedValue({ ok: true, status: 200, data: [prompt("a")] });
    runMock.mockResolvedValueOnce({ ok: false, message: "stale" });
    mount();
    fireEvent.click(await screen.findByText("promptCenter.action.startNow"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(runMock.mock.calls[0][3]).toBe("startNow");

    runMock.mockResolvedValueOnce({ ok: true });
    listMock.mockResolvedValue({ ok: true, status: 200, data: [] });
    fireEvent.click(screen.getByText("promptCenter.action.startNow"));
    await waitFor(() => expect(screen.queryByTestId("prompt-card")).toBeNull());
  });
});
