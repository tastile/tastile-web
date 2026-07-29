import { describe, expect, it } from "vitest";
import {
  FOCUS_RING_CLASS,
  INPUT_RADIUS,
  PANEL_ANIM_ATTR,
  SEGMENT_STYLES,
  SURFACE_CLASSES,
} from "./panel-styles";

describe("panel-styles", () => {
  it("exposes focus-ring class with outline utilities", () => {
    expect(FOCUS_RING_CLASS).toContain("focus-visible:outline");
    expect(FOCUS_RING_CLASS).toContain("var(--focus-ring)");
  });

  it("exposes surface classes for raised/elevated/inset", () => {
    expect(SURFACE_CLASSES.raised).toContain("var(--surface-1)");
    expect(SURFACE_CLASSES.elevated).toContain("var(--surface-3)");
    expect(SURFACE_CLASSES.inset).toContain("var(--surface-inset)");
  });

  it("matches Mantine default input radius", () => {
    expect(INPUT_RADIUS).toBe("rounded-md");
  });

  it("names the data attribute for reduced-motion targeting", () => {
    expect(PANEL_ANIM_ATTR).toBe("data-panel-anim");
  });

  it("keeps the legacy segment styles constant", () => {
    expect(SEGMENT_STYLES.root.backgroundColor).toBe("var(--surface-2)");
  });
});