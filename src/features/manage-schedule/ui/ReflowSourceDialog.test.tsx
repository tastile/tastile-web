/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { renderWithMantine } from "@/test/render-with-mantine";
import type { SourceTileDetail } from "@/shared/api/v1/source-tiles";
import type { CommandResponse } from "@/shared/model/v1/envelope";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import { ReflowSourceDialog } from "./ReflowSourceDialog";

const getSourceTileMock = vi.fn();
const previewMock = vi.fn();
const reflowMock = vi.fn();

vi.mock("@/shared/api/v1/source-tiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/v1/source-tiles")>();
  return {
    ...actual,
    getSourceTile: (...args: unknown[]) => getSourceTileMock(...args),
    previewSourceTileReflow: (...args: unknown[]) => previewMock(...args),
    reflowSourceTile: (...args: unknown[]) => reflowMock(...args),
  };
});

vi.mock("@/shared/api/v1/submit", () => ({
  makeClient: () => ({ baseUrl: "http://test", getIdToken: async () => null }),
}));

const detail = {
  source: { source_tile_id: "src-1", revision: 3, title: "Break" },
  relations: [],
  occurrences: [],
  placements: [
    {
      placement_id: "pl-1",
      source_tile_id: "src-1",
      occurrence_id: "occ-1",
      split_group_id: "sg-1",
      split_index: 0,
      split_count: 1,
      start: "2999-01-01T09:00:00Z",
      end: "2999-01-01T09:30:00Z",
      closed: false,
      closed_at: null,
      revision: 1,
    },
  ],
} as unknown as SourceTileDetail;

const commandResponse = (placementIds: string[]): CommandResponse =>
  ({
    commandId: "cmd-1",
    acceptedAt: "2026-01-01T00:00:00Z",
    aggregate: null,
    revision: 4,
    result: 0,
    pending: [],
    aggregateMeta: {
      occurrenceIds: ["occ-1"],
      placementIds,
      unplacedOccurrences: [],
    },
  }) as unknown as CommandResponse;

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithMantine(
    <QueryClientProvider client={queryClient}>
      <ReflowSourceDialog
        opened
        onClose={() => {}}
        sourceTileId="src-1"
        title="Break"
      />
    </QueryClientProvider>,
  );
}

describe("ReflowSourceDialog", () => {
  beforeEach(() => {
    getSourceTileMock.mockReset().mockResolvedValue({ ok: true, data: detail, status: 200 });
    previewMock.mockReset();
    reflowMock.mockReset();
  });

  it("requires a preview before apply and sends the previewed revision", async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: commandResponse(["pl-new"]),
      status: 200,
    });
    reflowMock.mockResolvedValue({
      ok: true,
      data: commandResponse(["pl-new"]),
      status: 200,
    });
    const user = userEvent.setup();
    renderDialog();

    await waitFor(() => expect(getSourceTileMock).toHaveBeenCalled(), { timeout: 15000 });
    const apply = await screen.findByRole("button", { name: /apply reflow|再配置を適用/i }, { timeout: 15000 });
    expect(apply).toBeDisabled();

    await user.click(await screen.findByRole("button", { name: /^preview$|^プレビュー$/i }, { timeout: 15000 }));
    await waitFor(() => expect(previewMock).toHaveBeenCalled(), { timeout: 15000 });
    const previewArgs = previewMock.mock.calls[0][0];
    expect(previewArgs.sourceTileId).toBe("src-1");
    expect(previewArgs.expectedRevision).toBe(3);
    expect(previewArgs.range.start).toBeTruthy();
    expect(previewArgs.range.end).toBeTruthy();

    await waitFor(() => expect(apply).toBeEnabled(), { timeout: 15000 });
    expect(screen.getByText(/1 occurrences|1 件の発生/)).toBeInTheDocument();

    await user.click(apply);
    await waitFor(() => expect(reflowMock).toHaveBeenCalled(), { timeout: 15000 });
    const applyArgs = reflowMock.mock.calls[0][0];
    // Apply must reuse the previewed revision + range verbatim.
    expect(applyArgs.expectedRevision).toBe(3);
    expect(applyArgs.range).toEqual(previewArgs.range);
    await screen.findByText(/reflow applied|再配置を適用しました/, {}, { timeout: 15000 });
  }, 60000);

  it("on STALE_REVISION asks for re-preview instead of auto-resending", async () => {
    previewMock.mockResolvedValue({
      ok: true,
      data: commandResponse(["pl-new"]),
      status: 200,
    });
    reflowMock.mockResolvedValue({
      ok: false,
      error: {
        kind: ApiErrorKind.STALE_REVISION,
        message: "stale",
        currentRevision: 9,
      },
      retried: false,
    });
    const user = userEvent.setup();
    renderDialog();

    await waitFor(() => expect(getSourceTileMock).toHaveBeenCalledTimes(1), { timeout: 15000 });
    await user.click(await screen.findByRole("button", { name: /^preview$|^プレビュー$/i }, { timeout: 15000 }));
    const apply = await screen.findByRole("button", { name: /apply reflow|再配置を適用/i }, { timeout: 15000 });
    await waitFor(() => expect(apply).toBeEnabled(), { timeout: 15000 });
    await user.click(apply);

    await screen.findByText(/changed since the preview|プレビュー後にこのソースが変更/, {}, { timeout: 15000 });
    // Source is reloaded and preview cleared — apply cannot fire again
    // until the user previews the new revision.
    await waitFor(() => expect(getSourceTileMock).toHaveBeenCalledTimes(2), { timeout: 15000 });
    await waitFor(() => expect(apply).toBeDisabled(), { timeout: 15000 });
    expect(reflowMock).toHaveBeenCalledTimes(1);
  }, 60000);
});
