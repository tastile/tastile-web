"use client";

import { useState } from "react";

interface EvalResponse {
  engine?: string;
  ok?: boolean;
  occurrences?: number[][];
  count?: number;
  error?: { code?: string; message?: string };
  fallback_reason?: string;
}

const FIELD_LABELS: Array<{ key: keyof EvalInput; label: string; optional: boolean }> = [
  { key: "step_ms", label: "step_ms", optional: false },
  { key: "span_ms", label: "span_ms", optional: false },
  { key: "origin", label: "origin", optional: true },
  { key: "bounds_start", label: "bounds_start", optional: true },
  { key: "bounds_end", label: "bounds_end", optional: true },
  { key: "range_start_ms", label: "range_start_ms", optional: false },
  { key: "range_end_ms", label: "range_end_ms", optional: false },
];

type EvalInput = {
  step_ms: string;
  span_ms: string;
  origin: string;
  bounds_start: string;
  bounds_end: string;
  range_start_ms: string;
  range_end_ms: string;
};

const DEFAULT_INPUT: EvalInput = {
  step_ms: "3600000",
  span_ms: "1800000",
  origin: "1767225600000",
  bounds_start: "",
  bounds_end: "",
  range_start_ms: "1767231000000",
  range_end_ms: "1767236400000",
};

function parseIntField(raw: string, optional: boolean): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return optional ? null : "invalid";
  if (!/^[+-]?\d+$/.test(v)) return "invalid";
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : "invalid";
}

function toPayload(fields: EvalInput): { ok: true; body: unknown } | { ok: false; error: string } {
  const input: Record<string, number | null> = {};
  for (const { key, optional } of FIELD_LABELS) {
    const value = parseIntField(fields[key], optional);
    if (value === "invalid") {
      return { ok: false, error: `${key} must be an integer` };
    }
    input[key] = value;
  }
  return { ok: true, body: { opt_in: true, input } };
}

export default function V2SchedulerPage() {
  const [fields, setFields] = useState<EvalInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async () => {
    const payload = toPayload(fields);
    if (!payload.ok) {
      setFieldError(payload.error);
      setResult(null);
      setHttpStatus(null);
      return;
    }
    setFieldError(null);
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/v2/scheduler/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      setHttpStatus(res.status);
      if (!res.ok) {
        setResult({
          engine: "fallback",
          ok: false,
          fallback_reason: `http_${res.status}`,
        });
        return;
      }
      setResult((await res.json()) as EvalResponse);
    } catch (e) {
      setResult({ engine: "fallback", ok: false, fallback_reason: "request_failed" });
      setHttpStatus(null);
      console.warn("[v2-scheduler] request failed", e);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-[590] text-foreground">v2 scheduler evaluation (opt-in)</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Runs the local tastile-v2 runtime via the BFF adapter. This page is
        verification-only; the default scheduling path is unchanged.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {FIELD_LABELS.map(({ key, label, optional }) => (
          <label key={key} className="block text-sm">
            <span className="text-foreground-muted">
              {label}
              {optional ? " (optional)" : ""}
            </span>
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-sm"
              value={fields[key]}
              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
              inputMode="numeric"
            />
          </label>
        ))}
      </div>

      {fieldError && (
        <div className="mt-4 text-sm text-red-600">{fieldError}</div>
      )}

      <button
        type="button"
        className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        onClick={submit}
        disabled={pending}
      >
        {pending ? "Evaluating…" : "Evaluate via v2"}
      </button>

      {result && (
        <div className="mt-6 rounded border border-border p-4">
          <div className="text-sm">
            engine: <code>{result.engine ?? "unknown"}</code>
            {httpStatus !== null ? ` · http ${httpStatus}` : ""}
            {result.ok !== undefined ? ` · ok=${String(result.ok)}` : ""}
          </div>
          {result.error && (
            <div className="mt-2 text-sm text-red-600">
              error: {result.error.code} — {result.error.message}
            </div>
          )}
          {result.fallback_reason && (
            <div className="mt-2 text-sm text-amber-600">
              fallback: {result.fallback_reason}
            </div>
          )}
          {result.occurrences && (
            <table className="mt-3 w-full text-sm font-mono">
              <thead>
                <tr className="text-left text-foreground-muted">
                  <th>occurrence</th>
                  <th>start_ms</th>
                  <th>end_ms</th>
                </tr>
              </thead>
              <tbody>
                {result.occurrences.map((row, i) => (
                  <tr key={i}>
                    <td>{i}</td>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <pre className="mt-3 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
