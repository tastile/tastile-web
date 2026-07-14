// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  publish: vi.fn(),
}));

vi.mock("@/lib/api/v1/schedule-definition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/v1/schedule-definition")>();
  return {
    ...actual,
    listReferenceCatalog: mocks.catalog,
    publishScheduleDefinition: mocks.publish,
  };
});
vi.mock("@/lib/api/v1/submit", () => ({ makeClient: () => ({ baseUrl: "/api/proxy" }) }));
vi.mock("@/lib/hooks/use-current-actor", () => ({ useCurrentActorSubjectId: () => "owner-1" }));

import { FloatingScheduleEditor } from "./FloatingScheduleEditor";

const catalogEntry = {
  placement_id: "018f0000-0000-7000-8000-000000000001",
  tile_id: "tile",
  plan_id: "plan",
  title: "一学期",
  span_start: "2026-04-01T00:00:00Z",
  span_end: "2026-07-31T23:59:59Z",
  role: 1,
};

describe("FloatingScheduleEditor", () => {
  beforeEach(() => {
    mocks.catalog.mockReset().mockResolvedValue({ ok: true, data: [catalogEntry], status: 200 });
    mocks.publish.mockReset().mockResolvedValue({
      ok: true,
      tileId: "tile",
      planId: "plan",
      windowsIds: [],
      flowIds: [],
    });
  });

  it("starts with only the human scheduling inputs and no fixed-time implementation fields", async () => {
    render(<FloatingScheduleEditor onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByLabelText("タイル名")).not.toBeNull();
    expect(screen.getByLabelText("必要時間（分）")).not.toBeNull();
    expect(screen.getByLabelText("配置できる期間")).not.toBeNull();
    expect(screen.getByRole("button", { name: "空き時間へ配置する" })).not.toBeNull();
    expect(screen.queryByText(/UUID|TERM|AST/i)).toBeNull();
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it("selects a label with the keyboard and publishes one aggregate without a placement API", async () => {
    const onSaved = vi.fn();
    render(<FloatingScheduleEditor onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("タイル名"), { target: { value: "競プロ" } });
    fireEvent.change(screen.getByLabelText("必要時間（分）"), { target: { value: "90" } });
    const picker = await screen.findByLabelText("配置できる期間");
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.change(picker, { target: { value: catalogEntry.placement_id } });
    fireEvent.click(screen.getByRole("button", { name: "空き時間へ配置する" }));

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(mocks.publish.mock.calls[0][0].payload).not.toHaveProperty("placement");
    expect(mocks.publish.mock.calls[0][0].payload.windows[0].bounds).toEqual({
      start: catalogEntry.span_start,
      end: catalogEntry.span_end,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("distinguishes catalog failure from an empty catalog and retries accessibly", async () => {
    mocks.catalog
      .mockResolvedValueOnce({ ok: false, error: { message: "offline" } })
      .mockResolvedValueOnce({ ok: true, data: [catalogEntry], status: 200 });
    render(<FloatingScheduleEditor onClose={vi.fn()} onSaved={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toContain("読み込めませんでした");
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("option", { name: /一学期/ })).not.toBeNull();
  });
});
