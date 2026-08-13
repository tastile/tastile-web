import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { TileReferencePicker } from "@/features/create-tile/ui/TileReferencePicker";
import { cn } from "@/shared/lib/cn";
import type { Plan } from "@/shared/model/v1/tile-types";
import { FormPanel, FormRow, SectionHeader } from "@/shared/ui/form";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import { Button, NumberInput, SegmentedControl } from "@mantine/core";
import { Calendar, Check, Link2, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";

export interface ReferencesSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  plan: Plan;
  setField: (path: string, value: unknown) => void;
}

export function ReferencesSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  plan,
  setField,
}: ReferencesSubPanelProps) {
  const [referencePickerIndex, setReferencePickerIndex] = useState<number | null>(null);

  return (
    <SubPanelShell
      panelKey="references"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="references-heading"
      title={t("quickCreate.referencesNavTitle")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <FormPanel>
        <SectionHeader icon={Link2} title={t("quickCreate.referencesNavTitle")} />
        {plan.references.length === 0 ? (
          <p className="text-xs text-foreground-muted">{t("quickCreate.referenceEmptyListHint")}</p>
        ) : null}
        <div className="flex flex-col gap-4">
          {plan.references.map((ref, index) => {
            const refIdDisplay = ref.id || `ref_${index + 1}`;
            const hasTarget = ref.target.referenceId !== null && ref.target.referenceId !== "";
            const intervalValue = (() => {
              const m = ref.pick.momentId ? Number(ref.pick.momentId) : 10;
              return Number.isFinite(m) && m > 0 ? m : 10;
            })();
            return (
              <div
                key={ref.id || `ref_${index + 1}`}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3"
                data-testid={`reference-card-${index}`}
              >
                <FormRow icon={<Calendar className="h-4 w-4" aria-hidden />} className="items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{t("quickCreate.referenceTargetLabel")}</span>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-surface-0 p-3",
                        hasTarget ? "bg-accent-soft" : "border-border",
                      )}
                      data-testid={`reference-target-card-${index}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                        <Calendar size={18} aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {hasTarget ? ref.target.referenceId : t("quickCreate.referenceTargetEmpty")}
                        </span>
                        <span className="truncate text-xs text-foreground-muted">
                          {t("quickCreate.referenceTargetBadge")}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={hasTarget ? "light" : "filled"}
                      onClick={() => setReferencePickerIndex(index)}
                      leftSection={<Search size={14} aria-hidden="true" />}
                      data-testid={`reference-picker-trigger-${index}`}
                      aria-label={t("quickCreate.tilePickerPickAria")}
                      className="justify-start"
                      styles={{
                        root: {
                          backgroundColor: hasTarget
                            ? "var(--accent-soft, var(--surface-2))"
                            : "var(--surface-2)",
                          color: "var(--foreground)",
                        },
                      }}
                    >
                      {hasTarget ? ref.target.referenceId : t("quickCreate.referenceIdPlaceholder")}
                    </Button>
                  </div>
                </FormRow>

                <FormRow icon={<Link2 className="h-4 w-4" aria-hidden />} className="items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{t("quickCreate.referenceRelationLabel")}</span>
                    <SegmentedControl
                      size="sm"
                      fullWidth
                      radius="md"
                      withItemsBorders={false}
                      value={String(ref.pick.kind)}
                      onChange={(next) => {
                        const updated = plan.references.slice();
                        updated[index] = { ...ref, pick: { ...ref.pick, kind: Number(next) } };
                        setField("plan.references", updated);
                      }}
                      data={[
                        { value: "4", label: t("quickCreate.referenceRelationAfter") },
                        { value: "3", label: t("quickCreate.referenceRelationBefore") },
                        { value: "1", label: t("quickCreate.referenceRelationFirst") },
                        { value: "2", label: t("quickCreate.referenceRelationLast") },
                        { value: "0", label: t("quickCreate.referenceRelationAll") },
                      ]}
                      data-testid={`reference-relation-tabs-${index}`}
                      styles={SEGMENT_STYLES}
                    />
                  </div>
                </FormRow>

                <FormRow icon={<Calendar className="h-4 w-4" aria-hidden />} className="items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium">{t("quickCreate.referenceIntervalLabel")}</span>
                    <div
                      className="flex items-center gap-2"
                      data-testid={`reference-interval-stepper-${index}`}
                    >
                      <NumberInput
                        min={5}
                        max={120}
                        step={5}
                        value={intervalValue}
                        onChange={(value) => {
                          const num = typeof value === "number" ? value : Number(value);
                          if (!Number.isFinite(num)) return;
                          const next = Math.max(5, Math.min(120, num));
                          if (next === intervalValue) return;
                          const updated = plan.references.slice();
                          updated[index] = { ...ref, pick: { ...ref.pick, momentId: String(next) } };
                          setField("plan.references", updated);
                        }}
                        size="xs"
                        aria-label={t("quickCreate.referenceIntervalLabel")}
                        suffix={t("quickCreate.referenceIntervalUnitMin")}
                        styles={{ input: { backgroundColor: "var(--surface-2)" } }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </FormRow>

                <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="subtle"
                    leftSection={<Trash2 size={12} aria-hidden="true" />}
                    onClick={() => {
                      const next = plan.references.slice();
                      next.splice(index, 1);
                      setField("plan.references", next);
                    }}
                    className="text-danger hover:bg-danger/10"
                  >
                    {t("quickCreate.referenceRemoveLabel")}
                  </Button>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    leftSection={<X size={12} aria-hidden="true" />}
                    onClick={() => setActivePanel("base")}
                  >
                    {t("quickCreate.referenceCancelLabel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="filled"
                    leftSection={<Check size={12} aria-hidden="true" />}
                    onClick={() => setActivePanel("base")}
                  >
                    {t("quickCreate.referenceApplyLabel")}
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="default"
            leftSection={<Plus size={12} aria-hidden="true" />}
            onClick={() => {
              setField("plan.references", [
                ...plan.references,
                {
                  id: "",
                  target: { kind: 0, contextKind: null, referenceId: null, conditionId: null },
                  pick: { kind: 4, momentId: "10" },
                },
              ]);
            }}
            data-testid="reference-add-button"
          >
            {t("quickCreate.addReference")}
          </Button>
        </div>
        <TileReferencePicker
          opened={referencePickerIndex !== null}
          onClose={() => setReferencePickerIndex(null)}
          onSelect={(tileId) => {
            if (referencePickerIndex === null) return;
            const idx = referencePickerIndex;
            const ref = plan.references[idx];
            if (!ref) return;
            const next = plan.references.slice();
            next[idx] = {
              ...ref,
              target: { ...ref.target, referenceId: tileId ?? null },
            };
            setField("plan.references", next);
          }}
          currentValue={
            referencePickerIndex !== null
              ? (plan.references[referencePickerIndex]?.target.referenceId ?? null)
              : null
          }
        />
      </FormPanel>
    </SubPanelShell>
  );
}
