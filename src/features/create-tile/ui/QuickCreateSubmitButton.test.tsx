/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateSubmitButton } from "./QuickCreateSubmitButton";
import { renderWithMantine } from "@/test/render-with-mantine";

if (
  typeof window !== "undefined" &&
  typeof window.matchMedia !== "function"
) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function resetStore() {
  useQuickCreateStore.setState({
    submitState: { kind: "idle" },
    canSubmit: false,
    mode: "create",
  });
}

describe("QuickCreateSubmitButton", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    resetStore();
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: "ja" });
    resetStore();
    vi.clearAllMocks();
  });

  it("renders the create label and the canonical testid", () => {
    renderWithMantine(<QuickCreateSubmitButton />);
    const btn = screen.getByTestId("quick-create-submit");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/create/i);
  });

  it("renders the update label when mode is edit", () => {
    useQuickCreateStore.setState({ mode: "edit", canSubmit: true });
    renderWithMantine(<QuickCreateSubmitButton />);
    const btn = screen.getByTestId("quick-create-submit");
    expect(btn).toHaveTextContent(/update/i);
  });

  it("is disabled when canSubmit is false", () => {
    renderWithMantine(<QuickCreateSubmitButton />);
    expect(screen.getByTestId("quick-create-submit")).toBeDisabled();
  });

  it("is enabled when canSubmit is true", () => {
    useQuickCreateStore.setState({ canSubmit: true });
    renderWithMantine(<QuickCreateSubmitButton />);
    expect(screen.getByTestId("quick-create-submit")).toBeEnabled();
  });

  it("shows loading state when submitState.kind === 'submitting'", () => {
    useQuickCreateStore.setState({
      canSubmit: true,
      submitState: { kind: "submitting" },
    });
    renderWithMantine(<QuickCreateSubmitButton />);
    expect(screen.getByTestId("quick-create-submit")).toHaveAttribute("data-loading", "true");
  });

  it("dispatches a `quick-create:submit` window event on click", async () => {
    useQuickCreateStore.setState({ canSubmit: true });
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("quick-create:submit", listener);
    renderWithMantine(<QuickCreateSubmitButton />);
    await user.click(screen.getByTestId("quick-create-submit"));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("quick-create:submit", listener);
  });
});
