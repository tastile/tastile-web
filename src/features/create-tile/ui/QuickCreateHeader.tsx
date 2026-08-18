"use client";

import { CloseButton, TextInput } from "@mantine/core";
import type { ReactNode } from "react";

import { FormRow } from "@/shared/ui/form";

import { QuickCreateSubmitButton } from "./QuickCreateSubmitButton";

/**
 * Title row shared across the QuickCreate workflow panels and any
 * modal-launched authoring surface (e.g. TaskDefinitionEditorModal).
 *
 * Layout mirrors the panel header pattern: a `FormRow` whose icon slot
 * hosts a `CloseButton` (cancel / dismiss), whose content slot hosts an
 * unstyled underlined title `TextInput`, and whose trailing slot hosts a
 * submit affordance. The submit button is `QuickCreateSubmitButton` by
 * default; modal callers pass their own button element via `submitButton`.
 *
 * The `qc-underline-input` className (declared globally in
 * `src/app/globals.css`) replaces Mantine v9's default input border with
 * a quiet bottom underline that brightens on focus — both in the panel
 * and inside Mantine modals.
 */
export interface QuickCreateHeaderProps {
  /** Controlled title value. */
  value: string;
  /** Controlled title change handler. */
  onChange: (next: string) => void;
  /** Close / cancel handler. */
  onClose: () => void;
  /**
   * Submit button element. Defaults to `<QuickCreateSubmitButton />`
   * (which dispatches `quick-create:submit`). Modal callers pass their
   * own button (e.g. Add / Save) here.
   */
  submitButton?: ReactNode;
  /** Title input placeholder. */
  placeholder?: string;
  /** Title input test id. */
  titleTestId?: string;
  /** Cancel button test id. */
  closeTestId?: string;
  /** Cancel button aria-label. */
  closeAriaLabel?: string;
  /** Whether the title is required. */
  required?: boolean;
  /** Whether to autofocus the title input on mount. */
  autoFocus?: boolean;
  /**
   * Whether to wrap the row in a `px-4 py-2` div. The panels use this
   * padding to align with their `<Stack gap={0}>` shell; modals already
   * own the surrounding padding and should pass `padded={false}`.
   */
  padded?: boolean;
}

export function QuickCreateHeader({
  value,
  onChange,
  onClose,
  submitButton,
  placeholder,
  titleTestId,
  closeTestId,
  closeAriaLabel = "Cancel",
  required = false,
  autoFocus = false,
  padded = true,
}: QuickCreateHeaderProps) {
  const formRow = (
    <FormRow
      icon={
        <CloseButton
          onClick={onClose}
          aria-label={closeAriaLabel}
          data-testid={closeTestId}
          size="sm"
        />
      }
      trailing={submitButton ?? <QuickCreateSubmitButton />}
    >
      <TextInput
        variant="unstyled"
        size="lg"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        required={required}
        autoFocus={autoFocus}
        data-testid={titleTestId}
        aria-required={required ? "true" : undefined}
        // Visible bottom underline is enforced by a CSS rule in
        // `src/app/globals.css` (`.qc-underline-input`) — Mantine v9's
        // `mantine-Input-input` module class sets a shorthand `border`
        // that would otherwise win over Tailwind's `border-b-2`.
        classNames={{
          input:
            "qc-underline-input text-[20px] font-semibold leading-snug text-foreground placeholder:text-[var(--foreground-muted)] placeholder:font-normal bg-transparent px-0 h-auto",
        }}
      />
    </FormRow>
  );

  if (padded) {
    return <div className="px-4 py-2">{formRow}</div>;
  }
  return formRow;
}