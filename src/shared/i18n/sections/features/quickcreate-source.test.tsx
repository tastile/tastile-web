// @vitest-environment jsdom

import { SubmitBar } from "@/features/create-tile/ui/SubmitBar";
import { renderWithMantine } from "@/test/render-with-mantine";
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  quickCreateEn,
  quickCreateEs,
  quickCreateJa,
  quickCreateKo,
  quickCreateZhCn,
} from "./quickcreate-source";

describe("quick-create translations", () => {
  it.each([
    ["en", quickCreateEn.discardDraft],
    ["ja", quickCreateJa.discardDraft],
    ["zh-CN", quickCreateZhCn.discardDraft],
    ["ko", quickCreateKo.discardDraft],
    ["es", quickCreateEs.discardDraft],
  ])("defines discardDraft for %s", (_locale, label) => {
    expect(label).toBeTruthy();
  });

  it("renders the Japanese discard action without English fallback text", () => {
    renderWithMantine(
      <SubmitBar
        canSubmit
        blockedReason={null}
        isSubmitting={false}
        serverError={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onDiscardDraft={vi.fn()}
        submitLabel="作成"
        cancelLabel="キャンセル"
        discardLabel={quickCreateJa.discardDraft}
      />,
    );

    const discard = screen.getByTestId("quick-create-discard-draft");
    expect(discard).toHaveTextContent("下書きを破棄");
    expect(discard).not.toHaveTextContent("Discard draft");
  });
});
