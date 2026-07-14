"use client";

/**
 * ReferencePicker — modal/popover for selecting a compatible reference target.
 *
 * Scaffold for Plan #6 Phase 4. Real implementation will query
 * `GET /v1/reference-catalog?usage=<LABEL_SPAN|PARENT_SPAN|GAP_ANCHOR>` and
 * surface actionable diagnostics for invalid / cyclic / closed candidates.
 *
 * Phase 4 leaves `referenceId` text inputs in place; the picker replaces them
 * once it is wired up.
 */

export interface ReferenceCatalogItem {
  placement_id: string;
  tile_id: string;
  plan_id: string;
  title: string;
  span_start: string;
  span_end: string;
  role: number;
}

export interface ReferencePickerProps {
  usage: "label_span" | "parent_span" | "gap_anchor";
  onSelect: (item: ReferenceCatalogItem) => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function ReferencePicker(_props: ReferencePickerProps) {
  return null;
}
