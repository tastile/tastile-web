/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMantine as render } from "@/test/render-with-mantine";

const listMock = vi.fn();
const submitMock = vi.fn();

vi.mock("@/lib/api/v1/sessions", () => ({
  listPendingSessions: (...args: unknown[]) => listMock(...args),
  submitFeedback: (...args: unknown[]) => submitMock(...args),
  getSession: vi.fn(),
}));

vi.mock("@/lib/api/v1/submit", () => ({
  makeClient: () => ({
    baseUrl: "/api/proxy/v1",
    useProxyBridge: true,
    getIdToken: async () => null,
  }),
}));

import { DecisionPromptSheet } from "./DecisionPromptSheet";
import type { SessionView } from "@/lib/api/v1/sessions";

const sessionA: SessionView = {
  id: "sess-a",
  status: "open",
  prompt: { title: "Pick a study slot", body: "Which evening?", why: null },
  interactionTree: {
    kind: "option",
    id: "when",
    label: "Pick a slot",
    options: [
      { id: "mon", label: "Monday" },
      { id: "tue", label: "Tuesday" },
    ],
  },
  baseRevision: 9,
};

const sessionB: SessionView = {
  id: "sess-b",
  status: "open",
  prompt: { title: "Confirm duration", body: "How long?" },
  interactionTree: {
    kind: "input",
    id: "dur",
    label: "Minutes",
    value: null,
  },
  baseRevision: 4,
};

function withQueryClient(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
}

describe("DecisionPromptSheet", () => {
  it("renders the empty state when no pending sessions exist", async () => {
    listMock.mockResolvedValueOnce({ ok: true, data: [], status: 200 });
    withQueryClient(<DecisionPromptSheet />);
    expect(await screen.findByTestId("decision-empty")).not.toBeNull();
  });

  it("renders one card per pending session", async () => {
    listMock.mockResolvedValueOnce({
      ok: true,
      data: [sessionA, sessionB],
      status: 200,
    });
    withQueryClient(<DecisionPromptSheet />);
    expect(await screen.findByTestId("decision-prompt-sheet")).not.toBeNull();
    expect(screen.getByTestId("decision-session-sess-a")).not.toBeNull();
    expect(screen.getByTestId("decision-session-sess-b")).not.toBeNull();
  });

  it("opens the interaction form when a pending session card is clicked", async () => {
    listMock.mockResolvedValueOnce({
      ok: true,
      data: [sessionA],
      status: 200,
    });
    withQueryClient(<DecisionPromptSheet />);
    const card = await screen.findByTestId("decision-session-sess-a");
    fireEvent.click(card);
    expect(await screen.findByTestId("interaction-node-when")).not.toBeNull();
    expect(
      screen.getByTestId(`interaction-option-${sessionA.interactionTree.id}-mon`),
    ).not.toBeNull();
  });

  it("submits feedback, refetches the list, and collapses the form on success", async () => {
    listMock
      .mockResolvedValueOnce({ ok: true, data: [sessionA], status: 200 })
      .mockResolvedValueOnce({ ok: true, data: [], status: 200 });
    submitMock.mockResolvedValueOnce({ ok: true, data: null, status: 200 });

    withQueryClient(<DecisionPromptSheet />);

    const card = await screen.findByTestId("decision-session-sess-a");
    fireEvent.click(card);
    await screen.findByTestId("interaction-node-when");

    fireEvent.click(
      screen.getByTestId(
        `interaction-option-${sessionA.interactionTree.id}-mon`,
      ),
    );
    fireEvent.click(
      screen.getByTestId(`interaction-submit-${sessionA.interactionTree.id}`),
    );

    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith(
        expect.anything(),
        "sess-a",
        expect.objectContaining({
          baseRevision: 9,
          answers: expect.objectContaining({ when: "mon" }),
        }),
      ),
    );
    expect(await screen.findByTestId("decision-empty")).not.toBeNull();
  });
});
