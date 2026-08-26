import {
  Button,
  ColorInput,
  Modal,
  Select,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";

import {
  createWorkspace,
  orderWorkspaceTree,
  useWorkspaces,
} from "@/shared/hooks/use-workspaces";

export interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
  t: (key: string) => string;
  setField: (path: string, value: unknown) => void;
  refreshProjects: () => Promise<void>;
}

const NONE_PARENT_VALUE = "";

export function CreateProjectModal({
  opened,
  onClose,
  t,
  setField,
  refreshProjects,
}: CreateProjectModalProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null);
  const [newProjectColor, setNewProjectColor] = useState<string | null>(null);
  const [newProjectBusy, setNewProjectBusy] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  const { workspaces, loading } = useWorkspaces();
  const tree = useMemo(() => orderWorkspaceTree(workspaces), [workspaces]);

  function handleClose() {
    if (newProjectBusy) return;
    setNewProjectName("");
    setNewProjectSlug("");
    setNewProjectParentId(null);
    setNewProjectColor(null);
    setNewProjectError(null);
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("quickCreate.projectCreateModalTitle")}
      centered
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmedName = newProjectName.trim();
          if (!trimmedName) {
            setNewProjectError(t("quickCreate.projectCreateNameRequired"));
            return;
          }
          if (newProjectBusy) return;
          setNewProjectBusy(true);
          setNewProjectError(null);
          void createWorkspace({
            display_name: trimmedName,
            slug: newProjectSlug.trim() || null,
            color: newProjectColor,
            parent_subject_id: newProjectParentId,
          })
            .then(async (ws) => {
              await refreshProjects();
              setField("meta.ownerSubjectId", ws.id);
              setNewProjectName("");
              setNewProjectSlug("");
              setNewProjectParentId(null);
              setNewProjectColor(null);
              onClose();
            })
            .catch((err: unknown) => {
              setNewProjectError((err as Error).message);
            })
            .finally(() => {
              setNewProjectBusy(false);
            });
        }}
        className="flex flex-col gap-3"
      >
        <TextInput
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.currentTarget.value)}
          placeholder={t("quickCreate.projectCreateNamePlaceholder")}
          maxLength={80}
          required
          disabled={newProjectBusy}
          data-testid="meta-project-create-name"
          label={t("quickCreate.projectCreateNameLabel")}
          size="sm"
        />
        <TextInput
          value={newProjectSlug}
          onChange={(e) => {
            const normalized = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
            setNewProjectSlug(normalized);
          }}
          placeholder={t("quickCreate.projectCreateSlugPlaceholder")}
          pattern="[a-z0-9-]+"
          maxLength={40}
          disabled={newProjectBusy}
          data-testid="meta-project-create-slug"
          label={t("quickCreate.projectCreateSlugLabel")}
          size="sm"
        />
        <Select
          label={t("quickCreate.projectCreateParentLabel")}
          placeholder={t("quickCreate.projectCreateParentNone")}
          data={[
            {
              value: NONE_PARENT_VALUE,
              label: t("quickCreate.projectCreateParentNone"),
            },
            ...tree.map((entry) => ({
              value: entry.workspace.id,
              label: `${"— ".repeat(entry.depth)}${entry.workspace.display_name}`,
            })),
          ]}
          value={newProjectParentId ?? NONE_PARENT_VALUE}
          onChange={(v) =>
            setNewProjectParentId(!v || v === NONE_PARENT_VALUE ? null : v)
          }
          clearable={false}
          searchable
          disabled={newProjectBusy || loading}
          size="sm"
          data-testid="meta-project-create-parent"
        />
        <ColorInput
          label={t("quickCreate.projectCreateColorLabel")}
          placeholder={t("quickCreate.projectCreateColorPlaceholder")}
          format="hex"
          fixOnBlur
          withPicker={false}
          withEyeDropper={false}
          swatches={[
            "#5e6ad2",
            "#10b981",
            "#a855f7",
            "#f59e0b",
            "#ef4444",
            "#6b7280",
            "#3b82f6",
          ]}
          value={newProjectColor ?? ""}
          onChange={(v) => setNewProjectColor(v || null)}
          disabled={newProjectBusy}
          size="sm"
          data-testid="meta-project-create-color"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={newProjectBusy}
            onClick={handleClose}
            data-testid="meta-project-create-cancel"
          >
            {t("quickCreate.projectCreateCancelLabel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={newProjectBusy}
            data-testid="meta-project-create-submit"
          >
            {t("quickCreate.projectCreateSubmitLabel")}
          </Button>
        </div>
        {newProjectError && (
          <span className="text-caption text-status-danger">{newProjectError}</span>
        )}
      </form>
    </Modal>
  );
}