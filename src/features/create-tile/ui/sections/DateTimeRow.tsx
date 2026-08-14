"use client";

import { DateInput } from "@mantine/dates";

import { FormRow } from "@/shared/ui/form";
import { TimeSuggestionInput } from "../TimeSuggestionInput";
import { dateToIso, isoToDate } from "../date-utils";

interface DateTimeRowProps {
  /** Current date value as an ISO string (matches `time.span.start/end` shape). */
  dateValue: string;
  /** Fired with the new ISO string when the date input changes. Empty string on clear. */
  onDateChange: (value: string | null) => void;
  /** Time value as "HH:MM". When omitted, the row renders the date input only. */
  timeValue?: string;
  /** Required when `timeValue` is provided. Receives the normalized "HH:MM" string. */
  onTimeChange?: (value: string) => void;
  datePlaceholder?: string;
  dateTestId?: string;
  timeTestId?: string;
  ariaLabelDate?: string;
  ariaLabelTime?: string;
  /** dayjs format passed to `<DateInput>`. Default `"YYYY-MM-DD"`. */
  dateFormat?: string;
  /** Mantine input size. Default `"sm"`. */
  size?: "sm" | "md";
  /** Scroll target for the time dropdown when no value is set. */
  defaultTimeScrollTo?: string;
  /** Whether the date input shows the clear button. Default `true`. */
  clearable?: boolean;
}

/**
 * Date + Time row — shared across the specialized workflow forms.
 *
 * Wraps a `<DateInput>` (main cell) and an optional `<TimeSuggestionInput>`
 * (trailing cell) in a `FormRow` with the standard `px-4 py-3` padding so
 * consumers can drop it in directly. The trailing slot is suppressed when
 * `timeValue` / `onTimeChange` are not provided — this lets the same
 * component serve the all-day variant of the Event form (date only) and
 * the standard time-bearing variant (date + time) without callers having
 * to wrap their own conditional.
 *
 * The row intentionally has no icon column: every workflow uses this row
 * structurally aligned with the title row above (no-icon), and the icon
 * column would have to be reserved for consistency anyway. Pass an icon
 * via the wrapper if a future form needs one — the existing `FormRow`
 * already reserves the 20px grid track whether or not `icon` is supplied.
 */
export function DateTimeRow({
  dateValue,
  onDateChange,
  timeValue,
  onTimeChange,
  datePlaceholder,
  dateTestId,
  timeTestId,
  ariaLabelDate,
  ariaLabelTime,
  dateFormat = "YYYY-MM-DD",
  size = "sm",
  defaultTimeScrollTo,
  clearable = true,
}: DateTimeRowProps) {
  const showTime = timeValue !== undefined && onTimeChange !== undefined;

  return (
    <div className="px-4 py-3">
      <FormRow
        trailing={
          showTime ? (
            <TimeSuggestionInput
              value={timeValue ?? ""}
              onChange={onTimeChange ?? (() => {})}
              aria-label={ariaLabelTime}
              data-testid={timeTestId}
              className="w-[5.5rem]"
              defaultScrollTo={defaultTimeScrollTo}
              size={size}
            />
          ) : undefined
        }
      >
        <DateInput
          value={isoToDate(dateValue)}
          onChange={(s) => onDateChange(s ? dateToIso(new Date(s)) : "")}
          valueFormat={dateFormat}
          placeholder={datePlaceholder}
          size={size}
          clearable={clearable}
          popoverProps={{ withinPortal: false }}
          aria-label={ariaLabelDate}
          data-testid={dateTestId}
          className="w-full"
        />
      </FormRow>
    </div>
  );
}
