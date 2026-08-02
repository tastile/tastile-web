import { FieldRow } from "@/features/create-tile/ui/FieldRow";
import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import type { TimeSlice } from "@/shared/stores/quick-create-store";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import { NumberInput, SegmentedControl } from "@mantine/core";

export interface DurationSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  time: TimeSlice;
  setField: (path: string, value: unknown) => void;
  getFieldError: (path: string) => string | null;
}

export function DurationSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  time,
  setField,
  getFieldError,
}: DurationSubPanelProps) {
  return (
    <SubPanelShell
      panelKey="duration"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="duration-heading"
      title={t("quickCreate.durationTitle")}
      description={t("quickCreate.durationSub")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <div className="mb-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
          {t("quickCreate.durationInputLabel")}
        </div>
        <SegmentedControl
          fullWidth
          size="sm"
          radius="md"
          data={[
            { value: "none", label: t("quickCreate.durationNoneTitle") },
            { value: "custom", label: t("quickCreate.durationInputLabel") },
          ]}
          value={
            time.durationMinMax.minMs === null && time.durationMinMax.maxMs === null
              ? "none"
              : "custom"
          }
          onChange={(value) => {
            if (value === "none") {
              setField("time.durationMinMax.minMs", null);
              setField("time.durationMinMax.maxMs", null);
            } else if (value === "custom") {
              const fallback = 30 * 60_000;
              setField("time.durationMinMax.minMs", fallback);
              setField("time.durationMinMax.maxMs", fallback);
            }
          }}
          styles={SEGMENT_STYLES}
        />
      </div>

      {time.durationMinMax.minMs !== null && (
        <div className="mb-4">
          <FieldRow
            label={t("quickCreate.durationInputLabel")}
            htmlFor="tile-duration-input"
            error={getFieldError("time.durationMinMax")}
          >
            <NumberInput
              id="tile-duration-input"
              min={10}
              step={10}
              value={Math.round(time.durationMinMax.minMs / 60000)}
              onChange={(value) => {
                const num = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(num)) return;
                const clamped = Math.max(10, Math.min(720, num));
                setField("time.durationMinMax.minMs", clamped * 60000);
                setField("time.durationMinMax.maxMs", clamped * 60000);
              }}
              size="sm"
              suffix={t("quickCreate.minutesUnit")}
              styles={{ input: { backgroundColor: "var(--surface-2)" } }}
            />
          </FieldRow>
        </div>
      )}
    </SubPanelShell>
  );
}
