// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";

import { RequiredTimePanel } from "./RequiredTimePanel";

describe("RequiredTimePanel", () => {
  it("edits required minutes without introducing a start or end time input", () => {
    const onChange = vi.fn();
    render(<RequiredTimePanel minutes={60} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Required time (min)"), { target: { value: "90" } });

    expect(onChange).toHaveBeenCalledWith(90);
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
  });
});
