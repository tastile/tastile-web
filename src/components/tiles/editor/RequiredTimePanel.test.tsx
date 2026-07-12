// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RequiredTimePanel } from "./RequiredTimePanel";

describe("RequiredTimePanel", () => {
  it("edits required minutes without introducing a start or end time input", () => {
    const onChange = vi.fn();
    render(<RequiredTimePanel minutes={60} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("必要時間（分）"), { target: { value: "90" } });

    expect(onChange).toHaveBeenCalledWith(90);
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
  });
});
