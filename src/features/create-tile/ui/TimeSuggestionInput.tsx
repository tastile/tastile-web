"use client";

import {
  Combobox,
  type ComboboxProps,
  InputBase,
  useCombobox,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

export interface TimeSuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  "data-testid"?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  stepMinutes?: number;
  withinPortal?: boolean;
  comboboxProps?: ComboboxProps;
  /** When value is empty, scroll to this time on open instead of 00:00. */
  defaultScrollTo?: string;
}

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(raw: string): string | null {
  const m = HHMM_RE.exec(raw.trim());
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * Time input with dropdown recommendations (Google Calendar style).
 *
 * Clicking the input opens a dropdown of preset times at fixed step
 * intervals — default 15 min — covering 00:00 → 23:45. When a value is
 * set, the dropdown opens scrolled to that option. When no value is set,
 * `defaultScrollTo` is used if provided; otherwise the dropdown opens at
 * the top.
 *
 * The input also accepts free-form entry: typing intermediate states
 * (e.g. "2", "22", "22:") stays local to the field so the user can keep
 * editing, and a normalized HH:MM is committed to `onChange` only on blur
 * or when a preset is clicked.
 */
export function TimeSuggestionInput({
  value,
  onChange,
  "aria-label": ariaLabel,
  "data-testid": dataTestid,
  className,
  size = "sm",
  stepMinutes = 15,
  withinPortal = false,
  comboboxProps,
  defaultScrollTo,
}: TimeSuggestionInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const presets = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += stepMinutes) {
        arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return arr;
  }, [stepMinutes]);

  const activeValue = value && presets.includes(value) ? value : null;

  /** Scroll target: use active value if set, otherwise fall back to defaultScrollTo. */
  const scrollTarget = activeValue ?? (defaultScrollTo && presets.includes(defaultScrollTo) ? defaultScrollTo : null);

  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!combobox.dropdownOpened) {
      setDraft(value);
    }
  }, [value, combobox.dropdownOpened]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!combobox.dropdownOpened) return;
    if (scrollTarget) {
      const idx = presets.indexOf(scrollTarget);
      if (idx >= 0) combobox.selectOption(idx);
    }
    const id = requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (!root) return;
      const active = scrollTarget
        ? root.querySelector<HTMLElement>(
            `[data-combobox-option="${scrollTarget}"]`,
          )
        : null;
      if (!active) return;
      const target = active.offsetTop - root.clientHeight / 2 + active.offsetHeight / 2;
      root.scrollTo({ top: Math.max(0, target), behavior: "instant" });
    });
    return () => cancelAnimationFrame(id);
  }, [combobox.dropdownOpened, scrollTarget, combobox, presets]);

  const commit = (raw: string) => {
    const normalized = normalizeTime(raw);
    if (normalized) {
      setDraft(normalized);
      if (normalized !== value) onChange(normalized);
    } else {
      setDraft(value);
    }
  };

  const handleOptionSubmit = (val: string) => {
    setDraft(val);
    onChange(val);
    combobox.closeDropdown();
  };

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleOptionSubmit}
      withinPortal={withinPortal}
      {...comboboxProps}
    >
      <Combobox.Target>
        <InputBase
          size={size}
          value={draft}
          onChange={(e) => {
            setDraft(e.currentTarget.value);
            if (!combobox.dropdownOpened) combobox.openDropdown();
          }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            commit(draft);
            combobox.closeDropdown();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
              combobox.closeDropdown();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              combobox.closeDropdown();
            }
          }}
          placeholder="--:--"
          aria-label={ariaLabel}
          data-testid={dataTestid}
          className={className}
          rightSection={<Combobox.Chevron size="sm" />}
          rightSectionPointerEvents="none"
          inputMode="numeric"
          styles={{
            input: {
              fontVariantNumeric: "tabular-nums",
            },
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          <div
            ref={scrollRef}
            className="max-h-[220px] overflow-y-auto"
          >
            {presets.map((t) => (
              <Combobox.Option key={t} value={t}>
                <span className="font-mono text-sm tabular-nums">{t}</span>
              </Combobox.Option>
            ))}
          </div>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
