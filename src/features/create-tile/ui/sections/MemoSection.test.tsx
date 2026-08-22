/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { MemoSection } from "./MemoSection";

// Mantine's Autosize Textarea calls scrollIntoView on mount.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Mantine's Autosize listens on `document.fonts` for font-loading events.
if (
  typeof document !== "undefined" &&
  typeof (document as { fonts?: unknown }).fonts === "undefined"
) {
  (document as unknown as { fonts: { addEventListener: () => void; removeEventListener: () => void } }).fonts = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function resetStore() {
  useQuickCreateStore.setState({
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("MemoSection", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("renders a textarea with the given testId", () => {
    renderWithMantine(<MemoSection testId="memo-test-id" />);
    expect(screen.getByTestId("memo-test-id")).toBeInTheDocument();
  });

  it("falls back to an empty placeholder when the i18n key resolves to empty", () => {
    renderWithMantine(
      <MemoSection
        testId="memo-test-id"
        placeholderKey="quickCreate.__intentionally_missing__"
      />,
    );
    const textarea = screen.getByTestId("memo-test-id") as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe("");
  });

  it("reflects the current meta.memo as the textarea value", () => {
    useQuickCreateStore.setState((state) => ({
      meta: { ...state.meta, memo: "preexisting note" },
    }));
    renderWithMantine(<MemoSection testId="memo-test-id" />);
    const textarea = screen.getByTestId("memo-test-id") as HTMLTextAreaElement;
    expect(textarea.value).toBe("preexisting note");
  });

  it("writes the typed text to meta.memo in the store", async () => {
    const user = userEvent.setup();
    renderWithMantine(<MemoSection testId="memo-test-id" />);

    const textarea = screen.getByTestId("memo-test-id");
    await user.type(textarea, "remember");

    expect(useQuickCreateStore.getState().meta.memo).toBe("remember");
  });
});
