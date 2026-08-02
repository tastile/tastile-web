import { createWorkspace } from "@/shared/hooks/use-workspaces";
import { Button, Modal, TextInput } from "@mantine/core";
import { useState } from "react";

export interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
  t: (key: string) => string;
  setField: (path: string, value: unknown) => void;
  refreshProjects: () => Promise<void>;
}

export function CreateProjectModal({
  opened,
  onClose,
  t,
  setField,
  refreshProjects,
}: CreateProjectModalProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [newProjectBusy, setNewProjectBusy] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  function handleClose() {
    if (newProjectBusy) return;
    setNewProjectName("");
    setNewProjectSlug("");
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
            color: null,
            parent_subject_id: null,
          })
            .then(async (ws) => {
              await refreshProjects();
              setField("meta.ownerSubjectId", ws.id);
              setNewProjectName("");
              setNewProjectSlug("");
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
          <span className="text-[11px] text-status-danger">{newProjectError}</span>
        )}
      </form>
    </Modal>
  );
}
