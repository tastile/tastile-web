/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Tile } from "@/lib/domain/tile";
import { TileId } from "@/lib/domain/ids";
import type { TileListView } from "@/lib/hooks/use-tile-list";
import { TileCardCompact } from "./TileCardCompact";

vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en" as const,
  }),
}));

const baseTile: Tile = {
  core: {
    id: TileId.fromString("019ef8d5-354a-7bd2-b22a-b4bd372ea0d1"),
    title: "study math",
    nextAction: null,
    doneDefinition: null,
    startedAt: null,
    completedAt: null,
    lifecycle: "ready",
  },
  work: { segments: [] },
  temporal: {
    tz: null,
    releaseAt: null,
    dueAt: null,
    fixedStart: new Date("2026-07-07T09:00:00Z"),
    fixedEnd: new Date("2026-07-07T10:00:00Z"),
    activeStart: null,
    activeEnd: null,
  },
  objective: {
    objectiveMode: "finish_once",
    targetWorkMin: 60,
    targetRestMin: null,
    doneRule: "manual",
    recurrence: null,
  },
  interruption: {
    interruptPenalty: 0,
    resumePenalty: 0,
    breakSplitsWork: false,
    externalInterruptOnly: false,
  },
  automation: {
    promptOnStart: false,
    promptOnEnd: false,
    autoStartAllowed: false,
    autoEndAllowed: false,
  },
  annotation: { semanticRole: "work", labels: [], timedLabels: [] },
};

const emptyTemporal = {
  tz: null,
  releaseAt: null,
  dueAt: null,
  fixedStart: null,
  fixedEnd: null,
  activeStart: null,
  activeEnd: null,
} as const;

const baseListView: TileListView = {
  id: "019ef8d5-354a-7bd2-b22a-b4bd372ea0d1",
  plan_id: null,
  title: "study math",
  lifecycle: 0,
  next_action: null,
  done_definition: null,
  worked_minutes: 0,
  break_minutes: 0,
  labels: [],
  objective_mode: 0,
  target_work_min: 60,
  target_rest_min: null,
  done_rule: null,
  resume_note: null,
  projected_next_start_at: null,
  temporal: null,
  recurrence: null,
  source: null,
};

const baseSource = {
  source_state: 0,
  generation_kind: 0,
  split_kind: 0,
  priority: 0,
  required_duration_ms: 0,
  window_start_offset_ms: 0,
  window_end_offset_ms: 0,
  weekday_mask: null,
  external_id: null,
  color: null,
  icon: null,
};

describe("TileCardCompact", () => {
  it("shows the fixed_start time when lifecycle is READY and a temporal anchor exists", () => {
    render(<TileCardCompact tile={baseTile} />);
    expect(screen.queryByText("tiles.unscheduled")).toBeNull();
    // formatFriendlyDateTime returns either "Today HH:MM" (diffDays == 0)
    // or "Mon DD HH:MM" for other days. Either way, it must produce some
    // formatted time text — never "tiles.unscheduled".
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeTruthy();
  });

  it("shows the unscheduled badge when lifecycle is READY and there is no temporal anchor", () => {
    const tile: Tile = {
      ...baseTile,
      temporal: { ...emptyTemporal },
    };
    render(<TileCardCompact tile={tile} />);
    expect(screen.getByText("tiles.unscheduled")).toBeTruthy();
  });

  it("renders the translated break source chip with numeric source kind", () => {
    const listView: TileListView = {
      ...baseListView,
      source: { ...baseSource, kind: 0 as const },
    };

    render(<TileCardCompact tile={baseTile} listView={listView} />);

    const chip = screen.getByText("tiles.source.break");
    expect(chip.getAttribute("data-source-kind")).toBe("0");
  });

  it("renders the translated legacy source chip with legacy source kind", () => {
    const listView: TileListView = {
      ...baseListView,
      source: { ...baseSource, kind: null },
    };

    render(<TileCardCompact tile={baseTile} listView={listView} />);

    const chip = screen.getByText("tiles.source.legacy");
    expect(chip.getAttribute("data-source-kind")).toBe("legacy");
  });

  it("renders nothing for the time column when lifecycle is STARTED but no temporal anchor exists", () => {
    const tile: Tile = {
      ...baseTile,
      core: { ...baseTile.core, lifecycle: "started", startedAt: null },
      temporal: { ...emptyTemporal },
    };
    render(<TileCardCompact tile={tile} />);
    // Lifecycle takes precedence over null-check: a STARTED tile with no
    // temporal anchor is a data error, not an "unscheduled" badge.
    expect(screen.queryByText("tiles.unscheduled")).toBeNull();
    // No formatted time text either — the badge slot stays empty.
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });
});