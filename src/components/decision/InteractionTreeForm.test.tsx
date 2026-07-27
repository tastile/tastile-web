/** @vitest-environment jsdom */
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { InteractionTreeForm } from "./InteractionTreeForm";
import type { InteractionNode } from "@/lib/api/v1/sessions";

function inputNode(): InteractionNode {
  return {
    kind: "input",
    id: "in-1",
    label: "Why is this happening?",
    value: null,
  };
}

function optionNode(): InteractionNode {
  return {
    kind: "option",
    id: "opt-1",
    label: "Pick a resolution",
    options: [
      { id: "now", label: "Right now" },
      { id: "later", label: "Later" },
    ],
  };
}

function renderForm(
  overrides: Partial<ComponentProps<typeof InteractionTreeForm>> = {},
) {
  const onSubmit = overrides.onSubmit ?? vi.fn();
  return render(
    <InteractionTreeForm
      node={overrides.node ?? optionNode()}
      baseRevision={overrides.baseRevision ?? 7}
      onSubmit={onSubmit}
    />,
  );
}

describe("InteractionTreeForm", () => {
  it("renders an input node with a TextInput bound to the answer state", () => {
    const node = inputNode();
    renderForm({ node });
    const input = screen.getByTestId(
      `interaction-input-${node.id}`,
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(
      screen
        .getByTestId(`interaction-node-${node.id}`)
        .getAttribute("data-base-revision"),
    ).toBe("7");
  });

  it("renders an option node with a Radio per option and continues disabled until selection", () => {
    const node = optionNode();
    if (node.kind !== "option") throw new Error("expected option node");
    renderForm({ node });
    for (const option of node.options) {
      expect(
        screen.getByTestId(`interaction-option-${node.id}-${option.id}`),
      ).not.toBeNull();
    }
    const submit = screen.getByTestId(
      `interaction-submit-${node.id}`,
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("submits the selected answers with the bound baseRevision", async () => {
    const node = optionNode();
    const onSubmit = vi.fn();
    renderForm({ node, onSubmit, baseRevision: 42 });

    fireEvent.click(
      screen.getByTestId(`interaction-option-${node.id}-later`),
    );
    fireEvent.click(
      screen.getByTestId(`interaction-submit-${node.id}`),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0] as Record<string, string>;
    expect(payload[node.id]).toBe("later");
    expect(
      screen
        .getByTestId(`interaction-node-${node.id}`)
        .getAttribute("data-base-revision"),
    ).toBe("42");
  });
});
