"use client";

import {
  blockedOccurrences,
  nextPlacements,
  reflowSummary,
  unplacedReasonKey,
} from "@/features/manage-schedule/model/reflow";
import {
  getSourceTile,
  previewSourceTileReflow,
  reflowSourceTile,
  type SourceTileDetail,
  type UtcSpan,
} from "@/shared/api/v1/source-tiles";
import { makeClient } from "@/shared/api/v1/submit";
import type { CommandResponse } from "@/shared/model/v1/envelope";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import { notifyEventsChanged } from "@/shared/hooks/calendar/use-events";
import { queryKeys } from "@/shared/query/query-keys";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

interface PreviewState {
  /** The revision the preview was computed against — apply reuses it. */
  revision: number;
  range: UtcSpan;
  response: CommandResponse;
}

function parseRangeInstant(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toUtcIso(value: string | null): string | null {
  return parseRangeInstant(value)?.toISOString() ?? null;
}

function formatInstant(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Source-wide reflow preview → apply confirmation (tastile-web#278).
 *
 * The apply step deliberately re-sends the *same* `expected_revision`
 * and `range` the preview showed. On STALE_REVISION the dialog asks the
 * user to reload and re-preview — it never auto-resends against the new
 * revision, so a plan the user confirmed is never silently swapped for
 * a different one. Individual placement moves stay on the separate
 * `POST /v1/placements/{id}/changes` path.
 */
export function ReflowSourceDialog({
  opened,
  onClose,
  sourceTileId,
  title,
}: {
  opened: boolean;
  onClose: () => void;
  sourceTileId: string;
  title: string;
}) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<SourceTileDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState<"load" | "preview" | "apply" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success" | "conflict"; text: string } | null>(
    null,
  );

  const load = async () => {
    setBusy("load");
    setLoadError(null);
    setNotice(null);
    const res = await getSourceTile(makeClient(), sourceTileId);
    setBusy(null);
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setDetail(res.data);
    setPreview(null);
  };

  useEffect(() => {
    if (!opened) return;
    const now = new Date();
    setRangeStart(now.toISOString());
    setRangeEnd(new Date(now.getTime() + DEFAULT_RANGE_MS).toISOString());
    setDetail(null);
    setPreview(null);
    setNotice(null);
    setLoadError(null);
    void load();
    // `load` is re-created each render; the effect intentionally runs only
    // when the dialog opens or the target changes.
  }, [opened, sourceTileId]);

  const rangeStartIso = toUtcIso(rangeStart);
  const rangeEndIso = toUtcIso(rangeEnd);
  const range: UtcSpan | null =
    rangeStartIso && rangeEndIso && rangeEndIso > rangeStartIso
      ? { start: rangeStartIso, end: rangeEndIso }
      : null;

  const previewMatchesCurrent =
    preview != null &&
    range != null &&
    preview.revision === detail?.source.revision &&
    preview.range.start === range.start &&
    preview.range.end === range.end;

  const runPreview = async () => {
    if (!detail || !range) return;
    setBusy("preview");
    setNotice(null);
    const res = await previewSourceTileReflow({
      client: makeClient(),
      sourceTileId,
      expectedRevision: detail.source.revision,
      range,
    });
    setBusy(null);
    if (!res.ok) {
      setPreview(null);
      if (res.error.kind === ApiErrorKind.STALE_REVISION) {
        setNotice({ kind: "conflict", text: t("panels.schedule.reflow.conflict") });
      } else {
        setNotice({ kind: "error", text: res.error.message });
      }
      return;
    }
    setPreview({ revision: detail.source.revision, range, response: res.data });
  };

  const runApply = async () => {
    if (!preview || !previewMatchesCurrent) return;
    setBusy("apply");
    setNotice(null);
    // Plain reflowSourceTile — NOT the auto-retry variant: a changed
    // plan must go back through preview + explicit confirmation.
    const res = await reflowSourceTile({
      client: makeClient(),
      sourceTileId,
      expectedRevision: preview.revision,
      range: preview.range,
    });
    setBusy(null);
    if (!res.ok) {
      if (res.error.kind === ApiErrorKind.STALE_REVISION) {
        setPreview(null);
        // load() clears `notice` synchronously, so the conflict message
        // is set after kicking it off.
        void load();
        setNotice({ kind: "conflict", text: t("panels.schedule.reflow.conflict") });
        return;
      }
      setNotice({ kind: "error", text: res.error.message });
      return;
    }
    setPreview(null);
    void load();
    setNotice({
      kind: "success",
      text: t("panels.schedule.reflow.success", {
        count: reflowSummary(res.data).placements,
      }),
    });
    notifyEventsChanged();
    window.dispatchEvent(new Event("tastile:tiles-changed"));
    void queryClient.invalidateQueries({ queryKey: queryKeys.placements });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurringTemplates });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tiles });
  };

  const upcoming = detail ? nextPlacements(detail.placements, new Date().toISOString()) : [];
  const blocked = detail ? blockedOccurrences(detail) : [];
  const previewSummary = preview ? reflowSummary(preview.response) : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("panels.schedule.reflow.title", { title })}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("panels.schedule.reflow.scopeNote")}
        </Text>

        {loadError && (
          <Text size="sm" c="red">
            {loadError}
          </Text>
        )}

        {detail && (
          <>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {t("panels.schedule.reflow.revisionLabel", {
                  revision: detail.source.revision,
                })}
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => void load()}
                loading={busy === "load"}
              >
                {t("panels.schedule.reflow.reload")}
              </Button>
            </Group>

            <div>
              <Text size="xs" fw={600} mb={4}>
                {t("panels.schedule.reflow.nextSchedule")}
              </Text>
              {upcoming.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("panels.schedule.reflow.noUpcoming")}
                </Text>
              ) : (
                <Stack gap={2}>
                  {upcoming.map((p) => (
                    <Text key={p.placement_id} size="sm">
                      {formatInstant(p.start, locale)} –{" "}
                      {formatInstant(p.end, locale)}
                    </Text>
                  ))}
                </Stack>
              )}
            </div>

            {blocked.length > 0 && (
              <div>
                <Text size="xs" fw={600} mb={4}>
                  {t("panels.schedule.reflow.blockedTitle")}
                </Text>
                <Stack gap={2}>
                  {blocked.map(({ occurrence, blocked: b }) => (
                    <Text key={occurrence.occurrence_id} size="sm" c="orange">
                      {formatInstant(occurrence.nominal_at, locale)} —{" "}
                      {t(`panels.schedule.reflow.reasons.${unplacedReasonKey(b.reason)}`)}
                      {b.conflicting_source_tile_id
                        ? ` (${b.conflicting_source_tile_id.slice(0, 8)})`
                        : ""}
                    </Text>
                  ))}
                </Stack>
              </div>
            )}
          </>
        )}

        <Group grow align="flex-end">
          <DateTimePicker
            label={t("panels.schedule.reflow.rangeStart")}
            value={rangeStart}
            onChange={(v) => setRangeStart(v)}
            size="sm"
            valueFormat="MM/DD HH:mm"
            clearable
            popoverProps={{ withinPortal: false }}
          />
          <DateTimePicker
            label={t("panels.schedule.reflow.rangeEnd")}
            value={rangeEnd}
            onChange={(v) => setRangeEnd(v)}
            size="sm"
            valueFormat="MM/DD HH:mm"
            clearable
            popoverProps={{ withinPortal: false }}
          />
        </Group>

        {previewSummary && preview && (
          <div>
            <Text size="xs" fw={600} mb={4}>
              {t("panels.schedule.reflow.previewTitle")}
            </Text>
            <Text size="sm">
              {t("panels.schedule.reflow.placedSummary", {
                occurrences: previewSummary.placedOccurrences,
                placements: previewSummary.placements,
              })}
            </Text>
            {previewSummary.unplaced.length > 0 && (
              <Stack gap={2} mt={4}>
                {previewSummary.unplaced.map((u) => (
                  <Text key={u.occurrenceId ?? u.blockedAt ?? "?"} size="sm" c="orange">
                    {u.blockedAt ? `${formatInstant(u.blockedAt, locale)} — ` : ""}
                    {t(`panels.schedule.reflow.reasons.${unplacedReasonKey(u.reason)}`)}
                    {u.conflictingSourceTileId
                      ? ` (${u.conflictingSourceTileId.slice(0, 8)})`
                      : ""}
                  </Text>
                ))}
              </Stack>
            )}
          </div>
        )}

        {notice && (
          <Text size="sm" c={notice.kind === "success" ? "green" : notice.kind === "conflict" ? "orange" : "red"}>
            {notice.text}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("panels.schedule.reflow.close")}
          </Button>
          <Button
            variant="light"
            onClick={() => void runPreview()}
            disabled={!detail || !range || busy !== null}
            loading={busy === "preview"}
          >
            {t("panels.schedule.reflow.preview")}
          </Button>
          <Button
            onClick={() => void runApply()}
            disabled={!previewMatchesCurrent || busy !== null}
            loading={busy === "apply"}
          >
            {t("panels.schedule.reflow.apply")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
