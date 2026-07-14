"use client";

import { useState } from "react";

import { publishScheduleDefinition } from "@/lib/api/v1/schedule-definition";
import { makeClient } from "@/lib/api/v1/submit";

import { AvailabilityPanel } from "./AvailabilityPanel";
import {
  buildFloatingSchedulePayload,
  type FloatingLabel,
  formatFloatingScheduleSummary,
} from "./floating-schedule";
import { RequiredTimePanel } from "./RequiredTimePanel";

export function FloatingScheduleEditor({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [label, setLabel] = useState<FloatingLabel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = title.trim().length > 0 && label !== null && !saving;
  const summary = formatFloatingScheduleSummary({ requiredMinutes: minutes, label });

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const payload = buildFloatingSchedulePayload({ title, requiredMinutes: minutes, label });
    const result = await publishScheduleDefinition({
      client: makeClient(),
      payload,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[56] flex w-full max-w-lg flex-col border-l border-border bg-surface-0 shadow-lg">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">タイルを作成</h2>
        <button type="button" onClick={onClose} className="text-sm text-foreground-muted">
          閉じる
        </button>
      </header>
      <main className="flex-1 space-y-6 overflow-y-auto p-5">
        <label className="block space-y-1">
          <span className="text-sm text-foreground">何をしますか？</span>
          <input
            aria-label="タイル名"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例: 競プロ"
            className="w-full rounded-md bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <RequiredTimePanel minutes={minutes} onChange={setMinutes} />
        <AvailabilityPanel label={label} onChange={setLabel} />
        <section aria-label="設定内容" className="rounded-md bg-surface-2 p-3">
          <p className="mb-2 text-xs font-medium text-foreground-muted">設定内容</p>
          <ul className="space-y-1 text-sm">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-border p-4">
        {error ? (
          <p role="alert" className="mb-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "保存中…" : "空き時間へ配置する"}
        </button>
      </footer>
    </div>
  );
}
