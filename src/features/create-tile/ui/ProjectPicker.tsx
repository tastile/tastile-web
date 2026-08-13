"use client";

import { Select } from "@mantine/core";
import { useState } from "react";

import { useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { CreateProjectModal } from "./CreateProjectModal";

interface ProjectPickerProps {
  testId?: string;
}

const NONE_VALUE = "";
const CREATE_VALUE = "__create__";

/**
 * Project picker — compact Select dropdown.
 *
 * Shows "Personal" as default, each workspace with its color dot, and a
 * trailing "+ New project..." action item that opens CreateProjectModal.
 */
export function ProjectPicker({
  testId = "quick-create-project-picker",
}: ProjectPickerProps) {
  const { t } = useTranslation();
  const ownerSubjectId = useQuickCreateStore((s) => s.meta.ownerSubjectId);
  const setField = useQuickCreateStore((s) => s.setField);
  const { workspaces, refresh, loading } = useWorkspaces();
  const [modalOpen, setModalOpen] = useState(false);

  const data = [
    {
      value: NONE_VALUE,
      label: t("quickCreate.projectOwnerDefault") || "Personal",
    },
    ...workspaces.map((w) => ({
      value: w.id,
      label: w.display_name,
      color: w.color,
    })),
    {
      value: CREATE_VALUE,
      label: t("quickCreate.projectCreateLabel") || "New project",
    },
  ];

  const currentValue = ownerSubjectId ?? NONE_VALUE;

  return (
    <>
      <Select
        value={currentValue}
        onChange={(val) => {
          if (val === CREATE_VALUE) {
            setModalOpen(true);
            return;
          }
          setField("meta.ownerSubjectId", val || null);
        }}
        data={data}
        size="xs"
        searchable
        clearable={false}
        data-testid={testId}
        disabled={loading}
        className="w-full"
        renderOption={({ option }) => {
          const ws = workspaces.find((w) => w.id === option.value);
          if (ws) {
            return (
              <span className="flex items-center gap-1.5">
                {ws.color ? (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ws.color }}
                    aria-hidden
                  />
                ) : null}
                {ws.display_name}
              </span>
            );
          }
          if (option.value === CREATE_VALUE) {
            return (
              <span className="text-foreground-muted">
                + {option.label}
              </span>
            );
          }
          return <span>{option.label}</span>;
        }}
      />
      <CreateProjectModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        t={t}
        setField={setField}
        refreshProjects={refresh}
      />
    </>
  );
}
