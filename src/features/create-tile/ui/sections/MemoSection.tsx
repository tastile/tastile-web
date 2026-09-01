"use client";

import { Textarea } from "@mantine/core";
import { FileText } from "lucide-react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";

interface MemoSectionProps {
	testId: string;
	/** Override the i18n placeholder key. Default: `quickCreate.memoPlaceholder`. */
	placeholderKey?: string;
}

/**
 * Memo / description row — shared across the specialized workflow forms.
 *
 * Renders a `FormRow` with a `FileText` icon and a borderless, autosizing
 * `Textarea` bound to `meta.memo`. The visible bottom underline is
 * enforced by the CSS rule for `.qc-underline-input--muted` so Mantine's
 * shorthand `border` doesn't win over Tailwind. Wrapped in `px-4 py-3`
 * so consumers can drop it in directly.
 */
export function MemoSection({
	testId,
	placeholderKey = "quickCreate.memoPlaceholder",
}: MemoSectionProps) {
	const { t } = useTranslation();
	const memo = useQuickCreateStore((s) => s.meta.memo);
	const setField = useQuickCreateStore((s) => s.setField);

	return (
		<div className="px-4 py-3">
			<FormRow icon={<FileText className="size-4" aria-hidden />}>
				<Textarea
					placeholder={t(placeholderKey)}
					value={memo}
					onChange={(e) => setField("meta.memo", e.currentTarget.value)}
					autosize
					minRows={2}
					maxRows={6}
					size="sm"
					variant="unstyled"
					data-testid={testId}
					aria-label={t(placeholderKey)}
					classNames={{
						input:
							"qc-underline-input--muted bg-transparent text-sm leading-relaxed text-foreground placeholder:text-[var(--foreground-muted)] px-0 w-full",
					}}
				/>
			</FormRow>
		</div>
	);
}
