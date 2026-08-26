"use client";

import { useTileList } from "@/shared/hooks/use-tile-list";
import { type Workspace, updateWorkspace, useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import { mapListView } from "@/shared/lib/map-list-view-to-tile";
import { Input } from "@/shared/ui/Input";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { TileCardCompact } from "@/tile/ui/TileCardCompact";
import { Button, Skeleton } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ProjectsMain() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const ownerId = searchParams.get("owner");
  const { workspaces, refresh, loading: wsLoading } = useWorkspaces();
  const project = ownerId ? workspaces.find((w) => w.id === ownerId) : null;
  const isPersonal = project?.kind === 0;

  const { tiles, loading } = useTileList({
    ownerIds: ownerId ? [ownerId] : undefined,
    limit: 500,
  });

  const headerTitle = project
    ? isPersonal
      ? t("panels.projects.personal")
      : project.display_name
    : t("panels.projects.allProjects");
  const headerDescription = project
    ? isPersonal
      ? t("panels.projects.personalDescription")
      : t("panels.projects.selectFromSidebar")
    : t("panels.projects.selectFromSidebar");

  return (
    <PageContainer>
      <PageHeader title={headerTitle} description={headerDescription} />

      {project && !isPersonal && (
        <ProjectEditForm
          key={project.id}
          project={project}
          tileCount={tiles.length}
          onSaved={refresh}
        />
      )}

      {/* v1/15 §6 #15: USER subject is the implicit personal scope and cannot
          be renamed or deleted. Show a read-only badge instead of the edit form. */}
      {project && isPersonal && (
        <section className="mt-4 rounded-lg border border-border/40 bg-surface-1 p-4 text-xs text-foreground-subtle">
          <span className="font-semibold">{t("panels.projects.personal")}</span>
          <span className="ml-2 text-[10px] text-foreground-lighter">
            {t("panels.projects.personalLocked")}
          </span>
        </section>
      )}

      {/* Scope info bar: spacing (mt-2 + pb-3) carries the visual hierarchy
          from the section above (DS v2). */}
      <div className="mt-2 flex items-center justify-between pb-3 text-xs text-foreground-subtle">
        <span className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-foreground-lighter">
          {project ? (
            <>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: project.color ?? "#6b7280" }}
              />
              owner_id: {project.id.slice(0, 8)} · slug: {project.slug ?? "(none)"}
            </>
          ) : (
            t("panels.projects.allProjects")
          )}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {loading || wsLoading
            ? t("panels.projects.loadingProjects")
            : t("panels.projects.itemsFound", { count: tiles.length })}
        </span>
      </div>

      <div className="mt-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        )}
        {!loading && tiles.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface-1 py-12 text-foreground-subtle">
            <p className="text-sm">{t("panels.projects.tilesEmpty")}</p>
          </div>
        )}
        {!loading && tiles.length > 0 && (
          <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xs">
            {tiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListView(t)} listView={t} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function ProjectEditForm({
  project,
  tileCount,
  onSaved,
}: {
  project: Workspace;
  tileCount: number;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  // Keyed by project.id at the call site — state re-initializes on project change.
  // react-doctor-disable-next-line react-doctor/no-derived-useState
  const [name, setName] = useState(project.display_name);
  const [slug, setSlug] = useState(project.slug ?? "");
  const [color, setColor] = useState(project.color ?? "#6b7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) {
      setError(t("panels.projects.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    // Promise chain instead of try/catch/finally in the render path so the
    // React Compiler sees a supported pattern. saving flag is reset via
    // .finally() on both success and failure paths.
    void updateWorkspace(project.id, {
      display_name: name.trim(),
      slug: slug.trim() || null,
      color,
    })
      .then(async () => {
        await onSaved();
      })
      .catch((e: unknown) => {
        setError((e as Error).message);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <section className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-border/40 bg-surface-1 p-4 md:grid-cols-3">
      <label htmlFor="project-name" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("panels.projects.nameLabel")}</span>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label htmlFor="project-slug" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("panels.projects.slugLabel")}</span>
        <Input
          id="project-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          pattern="[a-z0-9-]+"
          maxLength={40}
          placeholder={t("panels.projects.slugHint")}
        />
      </label>
      <label htmlFor="project-color" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("panels.projects.colorLabel")}</span>
        <input
          id="project-color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-full cursor-pointer rounded border border-border"
        />
      </label>
      <div className="flex items-center justify-between font-mono text-[10px] text-foreground-subtle md:col-span-3">
        <span>
          {tileCount} tiles · created{" "}
          {new Date(project.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-status-danger">{error}</span>}
          <Button onClick={save} disabled={saving || !name.trim()} size="sm">
            {saving ? t("panels.projects.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
