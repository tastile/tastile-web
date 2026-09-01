"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import type {
	SourceAuthoringSlice,
	TimeSlice,
} from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import {
	NumberInput,
	Select,
	SimpleGrid,
	Stack,
	TagsInput,
	Text,
	Tooltip,
} from "@mantine/core";
import { Clock, Globe, Scissors, XCircle } from "lucide-react";

interface SourceWindowPanelProps {
	source: SourceAuthoringSlice;
	time: TimeSlice;
	setField: (path: string, value: unknown) => void;
}

const minutes = (value: number | string) =>
	Math.max(0, Number(value) || 0) * 60_000;
const asMinutes = (value: number | null) =>
	value === null ? "" : value / 60_000;

export function SourceWindowPanel({
	source,
	time,
	setField,
}: SourceWindowPanelProps) {
	const { t } = useTranslation();

	return (
		<Stack gap="md" p="md">
			<FormRow icon={null}>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.heading")}
					</span>
					<span className="text-xs text-foreground-muted">
						{t("quickCreate.panel.sourceWindow.description")}
					</span>
				</div>
			</FormRow>

			<FormRow
				icon={<Clock className="size-4" aria-hidden />}
				className="items-start"
			>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.durationLabel")}
					</span>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						<NumberInput
							label={t("quickCreate.panel.sourceWindow.minMinutesLabel")}
							min={1}
							value={asMinutes(time.durationMinMax.minMs)}
							onChange={(value) =>
								setField("time.durationMinMax.minMs", minutes(value))
							}
						/>
						<NumberInput
							label={t("quickCreate.panel.sourceWindow.maxMinutesLabel")}
							min={1}
							value={asMinutes(time.durationMinMax.maxMs)}
							onChange={(value) =>
								setField("time.durationMinMax.maxMs", minutes(value))
							}
						/>
					</SimpleGrid>
				</div>
			</FormRow>

			<FormRow
				icon={<Clock className="size-4" aria-hidden />}
				className="items-start"
			>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.preferredDurationLabel")}
					</span>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						<NumberInput
							label={t("quickCreate.panel.sourceWindow.minMinutesLabel")}
							min={0}
							value={asMinutes(source.preferredDurationMinMax.minMs)}
							onChange={(value) =>
								setField(
									"source.preferredDurationMinMax.minMs",
									value === "" ? null : minutes(value),
								)
							}
						/>
						<NumberInput
							label={t("quickCreate.panel.sourceWindow.maxMinutesLabel")}
							min={0}
							value={asMinutes(source.preferredDurationMinMax.maxMs)}
							onChange={(value) =>
								setField(
									"source.preferredDurationMinMax.maxMs",
									value === "" ? null : minutes(value),
								)
							}
						/>
					</SimpleGrid>
				</div>
			</FormRow>

			<FormRow
				icon={<Globe className="size-4" aria-hidden />}
				className="items-start"
			>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.utcOffsetLabel")}
					</span>
					<NumberInput
						min={-840}
						max={840}
						value={source.offsetMin}
						onChange={(value) =>
							setField("source.offsetMin", Number(value) || 0)
						}
						aria-label={t("quickCreate.panel.sourceWindow.utcOffsetLabel")}
					/>
				</div>
			</FormRow>

			<FormRow icon={null}>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.placementPriorityLabel")}
					</span>
					<NumberInput
						value={source.priority}
						onChange={(value) =>
							setField("source.priority", Number(value) || 0)
						}
						aria-label={t(
							"quickCreate.panel.sourceWindow.placementPriorityLabel",
						)}
					/>
				</div>
			</FormRow>

			<FormRow
				icon={<XCircle className="size-4" aria-hidden />}
				className="items-start"
			>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.excludedDatesLabel")}
					</span>
					<TagsInput
						description={t(
							"quickCreate.panel.sourceWindow.excludedDatesDescription",
						)}
						placeholder={t(
							"quickCreate.panel.sourceWindow.excludedDatesPlaceholder",
						)}
						value={source.excludedDates}
						onChange={(value) => setField("source.excludedDates", value)}
						aria-label={t("quickCreate.panel.sourceWindow.excludedDatesLabel")}
					/>
				</div>
			</FormRow>

			<FormRow
				icon={<Scissors className="size-4" aria-hidden />}
				className="items-start"
			>
				<div className="flex flex-col gap-1">
					<span className="text-xs font-medium">
						{t("quickCreate.panel.sourceWindow.splitLabel")}
					</span>
					<Tooltip
						label={t("quickCreate.panel.sourceWindow.splitDisabled")}
						position="top"
						disabled={source.splitPolicy.kind !== 1}
					>
						<Select
							value={String(source.splitPolicy.kind)}
							data={[
								{
									value: "0",
									label: t("quickCreate.panel.sourceWindow.splitUnsplit"),
								},
							]}
							description={t("quickCreate.panel.sourceWindow.splitDisabled")}
							onChange={(value) => {
								const num = Number(value) as 0 | 1 | 2;
								if (num === 0 || num === 1 || num === 2) {
									setField("source.splitPolicy.kind", num);
								}
							}}
							aria-label={t("quickCreate.panel.sourceWindow.splitLabel")}
						/>
					</Tooltip>
				</div>
			</FormRow>

			{source.splitPolicy.kind === 1 ? (
				<FormRow
					icon={<Scissors className="size-4" aria-hidden />}
					className="items-start"
				>
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium">
							{t("quickCreate.panel.sourceWindow.splitSettingsLabel")}
						</span>
						<SimpleGrid cols={{ base: 1, sm: 3 }}>
							<NumberInput
								label={t("quickCreate.panel.sourceWindow.minSegmentLabel")}
								min={1}
								value={asMinutes(source.splitPolicy.minSegmentMs)}
								onChange={(value) =>
									setField(
										"source.splitPolicy.minSegmentMs",
										value === "" ? null : minutes(value),
									)
								}
							/>
							<NumberInput
								label={t("quickCreate.panel.sourceWindow.maxSegmentLabel")}
								min={1}
								value={asMinutes(source.splitPolicy.maxSegmentMs)}
								onChange={(value) =>
									setField(
										"source.splitPolicy.maxSegmentMs",
										value === "" ? null : minutes(value),
									)
								}
							/>
							<NumberInput
								label={t("quickCreate.panel.sourceWindow.maxSegmentsLabel")}
								min={1}
								value={source.splitPolicy.maxSegments ?? ""}
								onChange={(value) =>
									setField(
										"source.splitPolicy.maxSegments",
										value === "" ? null : Number(value),
									)
								}
							/>
						</SimpleGrid>
					</div>
				</FormRow>
			) : null}
		</Stack>
	);
}
