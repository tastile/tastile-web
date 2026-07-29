"use client";

import {
  Children,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useId,
} from "react";

interface Props {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}

export function FieldRow({ label, htmlFor, hint, error, required, children }: Props) {
  const hintId = useId();
  const errorId = useId();
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const child = Children.only(children);
  const enhanced = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-errormessage": errorId, "aria-invalid": true } : {}),
      })
    : child;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium flex items-center gap-1">
        {label}
        {required ? (
          <span aria-hidden className="text-[var(--color-danger,#dc2626)]">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <span id={hintId} className="text-[11px] text-[var(--foreground-muted)]">
          {hint}
        </span>
      ) : null}
      <div data-error={error ? "true" : undefined}>{enhanced}</div>
      {error ? (
        <span id={errorId} role="alert" className="text-[11px] text-[var(--color-danger,#dc2626)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
