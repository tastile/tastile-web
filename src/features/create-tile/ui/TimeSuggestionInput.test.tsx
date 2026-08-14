/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { TimeSuggestionInput } from "./TimeSuggestionInput";

if (typeof HTMLElement !== "undefined") {
  Object.defineProperties(HTMLElement.prototype, {
    scrollIntoView: {
      configurable: true,
      value: () => {},
    },
    scrollTo: {
      configurable: true,
      value: () => {},
    },
  });
}

describe("TimeSuggestionInput", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: "ja" });
  });

  it("renders the input with the --:-- placeholder", () => {
    renderWithMantine(<TimeSuggestionInput value="" onChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("--:--")).toBeInTheDocument();
  });

  it("lists the preset times in the dropdown", async () => {
    const user = userEvent.setup();
    renderWithMantine(<TimeSuggestionInput value="" onChange={vi.fn()} />);

    await user.click(screen.getByPlaceholderText("--:--"));

    expect(
      screen.getByRole("option", { name: "00:00", hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "12:15", hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "23:45", hidden: true }),
    ).toBeInTheDocument();
  });

  it("commits a custom time when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithMantine(<TimeSuggestionInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("--:--");

    await user.type(input, "10:07");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith("10:07");
  });

  it("commits a custom time when the input blurs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithMantine(<TimeSuggestionInput value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText("--:--"), "10:07");
    await user.tab();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("10:07");
  });

  it("does not commit or retain an invalid time on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithMantine(<TimeSuggestionInput value="09:30" onChange={onChange} />);
    const input = screen.getByPlaceholderText("--:--") as HTMLInputElement;

    await user.click(input);
    await user.clear(input);
    await user.tab();

    expect(input).toHaveValue("09:30");
    expect(onChange).not.toHaveBeenCalled();
  });
});
