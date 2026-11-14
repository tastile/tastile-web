"use client";

import {
  type PromptView,
  describePromptSubject,
  listPendingPrompts,
} from "@/shared/api/v1/prompts";
import { makeClient } from "@/shared/api/v1/submit";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type PromptActionId,
  actionsFor,
  kindKey,
  runPromptAction,
} from "../model/prompt-actions";

const PROMPTS_KEY = ["v1", "prompts", "pending"] as const;
/** Core raises drift prompts from the worker pass; poll at a similar cadence. */
const POLL_MS = 60_000;
/** Cards shown at once; the rest wait behind a count so the schedule stays visible. */
const VISIBLE = 3;

async function loadPrompts() {
  const client = makeClient();
  const pending = await listPendingPrompts(client);
  if (!pending.ok) throw new Error(pending.error.message);
  return Promise.all(
    pending.data.map(async (prompt) => ({
      prompt,
      subject: await describePromptSubject(client, prompt),
    })),
  );
}

/**
 * Drift between plan and execution (web#192): a missed start or an execution
 * running past its span. Each card offers the Core commands that resolve it.
 */
export function PromptCenter() {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: PROMPTS_KEY,
    queryFn: loadPrompts,
    refetchInterval: POLL_MS,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const items = query.data ?? [];
  if (items.length === 0) return null;

  const act = async (item: (typeof items)[number], action: PromptActionId) => {
    setBusy(item.prompt.id);
    setFailed(null);
    const outcome = await runPromptAction(makeClient(), item.prompt, item.subject, action);
    setBusy(null);
    if (!outcome.ok) {
      setFailed(item.prompt.id);
      return;
    }
    window.dispatchEvent(new Event("tastile:tiles-changed"));
    await queryClient.invalidateQueries({ queryKey: PROMPTS_KEY });
  };

  return (
    <section
      aria-label={t("promptCenter.title")}
      className="fixed right-4 bottom-12 z-40 w-[min(22rem,calc(100vw-2rem))]"
    >
      <Stack gap="xs">
        {items.slice(0, VISIBLE).map((item) => (
          <PromptCard
            key={item.prompt.id}
            prompt={item.prompt}
            title={item.subject.title ?? t("promptCenter.untitled")}
            when={plannedAt(item.subject.spanStart, locale)}
            actions={actionsFor(item.prompt, item.subject)}
            busy={busy === item.prompt.id}
            failed={failed === item.prompt.id}
            onAction={(action) => void act(item, action)}
          />
        ))}
        {items.length > VISIBLE && (
          <Text size="xs" c="dimmed" ta="right">
            {t("promptCenter.more", { count: items.length - VISIBLE })}
          </Text>
        )}
      </Stack>
    </section>
  );
}

function plannedAt(spanStart: string | null, locale: string): string | null {
  if (!spanStart) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(spanStart));
}

function PromptCard(props: {
  prompt: PromptView;
  title: string;
  when: string | null;
  actions: PromptActionId[];
  busy: boolean;
  failed: boolean;
  onAction: (action: PromptActionId) => void;
}) {
  const { t } = useTranslation();
  return (
    <Paper p="sm" radius="md" className="bg-surface-3" data-testid="prompt-card">
      <Text size="xs" c="dimmed">
        {t(kindKey(props.prompt.kind))}
        {props.when && ` · ${props.when}`}
      </Text>
      <Text fw={600} truncate>
        {props.title}
      </Text>
      {props.failed && (
        <Text size="xs" c="red" role="alert">
          {t("promptCenter.failed")}
        </Text>
      )}
      <Group gap="xs" mt="xs">
        {props.actions.map((action, index) => (
          <Button
            key={action}
            size="xs"
            variant={index === 0 ? "filled" : "default"}
            disabled={props.busy}
            onClick={() => props.onAction(action)}
          >
            {t(`promptCenter.action.${action}`)}
          </Button>
        ))}
      </Group>
    </Paper>
  );
}
