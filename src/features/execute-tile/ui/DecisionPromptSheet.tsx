"use client";

/**
 * DecisionPromptSheet — pending-decision surface backed by
 * `usePendingSessions` (TanStack Query, 15s poll) and
 * `submitFeedback` (raw-fetch POST to `/v1/sessions/{id}/feedback`).
 *
 * The list query already carries the full `SessionView` (id, prompt,
 * interactionTree, baseRevision), so no extra `getSession` round-trip is
 * needed to begin answering. On submit we call `submitFeedback`, refetch
 * the list so the answered session drops out of "open" status, then
 * collapse the active selection back to the list.
 *
 * On a stale `baseRevision` (409 from the core), we refetch and stay on
 * the list — never overwrite the user's last answer with a guessed
 * revision.
 *
 * Mantine styling intentionally stays inside the project's existing
 * shell vocabulary; the sheet rules from `feedback_panel_design.md`
 * (no accent, scrim ~0.28, panel ~0.95 bg) are honored by routing the
 * full-sheet wrapping through the shared `BottomSheet` in Task 8.
 */

import { InteractionTreeForm } from "@/features/execute-tile/ui/InteractionTreeForm";
import { submitFeedback } from "@/shared/api/v1/sessions";
import { makeClient } from "@/shared/api/v1/submit";
import { usePendingSessions } from "@/shared/hooks/use-pending-sessions";
import { useTranslation } from "@/shared/i18n/use-translation";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import { Alert, Button, Loader, Stack, Text } from "@mantine/core";
import { useState } from "react";

export function DecisionPromptSheet() {
  const { data: sessions, isLoading, refetch } = usePendingSessions();
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = (sessions ?? []).find((session) => session.id === activeId);

  if (active) {
    return (
      <Stack gap="md" data-testid="decision-active-form" data-base-revision={active.baseRevision}>
        <Text fw={500} size="lg">
          {active.prompt.title}
        </Text>
        <Text c="dimmed" size="sm">
          {active.prompt.body}
        </Text>
        {error && (
          <Alert color="red" data-testid="decision-feedback-error">
            {error}
          </Alert>
        )}
        <InteractionTreeForm
          node={active.interactionTree}
          baseRevision={active.baseRevision}
          busy={busy}
          onSubmit={async (answers) => {
            setBusy(true);
            setError(null);
            try {
              const result = await submitFeedback(makeClient(), active.id, {
                answers,
                baseRevision: active.baseRevision,
              });
              if (!result.ok) {
                const kind = result.error.kind;
                if (kind === ApiErrorKind.CONFLICT || kind === ApiErrorKind.STALE_REVISION) {
                  await refetch();
                  setError("This decision was updated. Please review and resubmit.");
                } else if (kind === ApiErrorKind.NOT_FOUND) {
                  await refetch();
                  setActiveId(null);
                } else {
                  setError(result.error.message);
                }
              } else {
                setActiveId(null);
                await refetch();
              }
            } catch {
              setError(t("common.unexpectedError"));
            }
            setBusy(false);
          }}
        />
      </Stack>
    );
  }

  if (isLoading) {
    return (
      <Stack align="center" gap="sm" data-testid="decision-loading" py="lg">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading pending prompts...
        </Text>
      </Stack>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Stack align="center" gap="xs" data-testid="decision-empty" py="lg">
        <Text size="sm" c="dimmed">
          No pending prompts.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm" data-testid="decision-prompt-sheet">
      <Text fw={500} size="lg">
        Pending prompts
      </Text>
      {sessions.map((session) => (
        <Button
          key={session.id}
          variant="default"
          justify="flex-start"
          data-testid={`decision-session-${session.id}`}
          onClick={() => {
            setError(null);
            setActiveId(session.id);
          }}
        >
          <Stack gap={2} align="flex-start">
            <Text size="sm" fw={500}>
              {session.prompt.title}
            </Text>
            <Text size="xs" c="dimmed">
              {session.prompt.body}
            </Text>
          </Stack>
        </Button>
      ))}
    </Stack>
  );
}
