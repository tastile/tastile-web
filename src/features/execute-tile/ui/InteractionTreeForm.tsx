"use client";

/**
 * InteractionTreeForm — render the v1 session's interaction tree and emit
 * a feedback payload `{ answers, baseRevision }`.
 *
 * Two `InteractionNode` kinds:
 *   - "input"  : a free-form text answer
 *   - "option" : a single choice from a fixed list
 *
 * The component owns its own answer state. On submit it calls
 * `onSubmit(answers)`; the parent combines that with `baseRevision` and
 * routes to `submitFeedback`. The form never POSTs on its own — the
 * parent owns the network call so it can also own refetch + close
 * semantics.
 *
 * The `baseRevision` is exposed via `data-base-revision` so tests + the
 * DecisionPromptSheet can assert the right snapshot was bound at the
 * time the submit was clicked.
 */

import type { InteractionNode } from "@/shared/api/v1/sessions";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button, Radio, Stack, TextInput } from "@mantine/core";
import { useState } from "react";

type AnswerMap = Record<string, string>;

interface InteractionTreeFormProps {
  node: InteractionNode;
  baseRevision: number;
  busy?: boolean;
  onSubmit: (answers: AnswerMap) => void | Promise<void>;
}

export function InteractionTreeForm({
  node,
  baseRevision,
  busy = false,
  onSubmit,
}: InteractionTreeFormProps) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const continueLabel = t("execution.decision.interactionContinue");

  if (node.kind === "input") {
    const current = answers[node.id] ?? node.value ?? "";
    return (
      <Stack gap="sm" data-testid={`interaction-node-${node.id}`} data-base-revision={baseRevision}>
        <TextInput
          label={node.label}
          value={current}
          data-testid={`interaction-input-${node.id}`}
          onChange={(event) => setAnswers({ ...answers, [node.id]: event.currentTarget.value })}
        />
        <Button
          type="button"
          loading={busy}
          data-testid={`interaction-submit-${node.id}`}
          onClick={() => {
            void onSubmit(answers);
          }}
        >
          {continueLabel}
        </Button>
      </Stack>
    );
  }

  const selected = answers[node.id] ?? "";

  return (
    <Stack gap="sm" data-testid={`interaction-node-${node.id}`} data-base-revision={baseRevision}>
      <Radio.Group
        label={node.label}
        value={selected}
        onChange={(value) => setAnswers({ ...answers, [node.id]: value })}
      >
        <Stack gap="xs">
          {node.options.map((option) => (
            <Radio
              key={option.id}
              value={option.id}
              label={option.label}
              data-testid={`interaction-option-${node.id}-${option.id}`}
            />
          ))}
        </Stack>
      </Radio.Group>
      <Button
        type="button"
        loading={busy}
        disabled={selected === ""}
        data-testid={`interaction-submit-${node.id}`}
        onClick={() => {
          void onSubmit(answers);
        }}
      >
        {continueLabel}
      </Button>
    </Stack>
  );
}
