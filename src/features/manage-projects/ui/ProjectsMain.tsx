"use client";

import { useTileList } from "@/shared/hooks/use-tile-list";
import { type Workspace, updateWorkspace, useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import { mapListView } from "@/shared/lib/map-list-view-to-tile";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { Input } from "@/shared/ui/Input";
import { PageContainer, PageHeader } from "@/shared/ui/page-header/PageHeader";
import { TileCardCompact } from "@/tile/ui/TileCardCompact";
import { Button, Skeleton } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function ProjectsMain() {
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const ownerId = searchParams.get("owner");
  const { workspaces, refresh: refreshWorkspaces, loading: wsLoading, error: wsError } = useWorkspaces();
  const project = ownerId ? workspaces.find((w) => w.id === ownerId) : null;
  const openCreate = useQuickCreateStore((s) => s.openCreate);
  const setField = useQuickCreateStore((s) => s.setField);

  const { tiles, loading, error: tileError, refresh: refreshTiles } = useTileList({
    ownerIds: ownerId ? [ownerId] : undefined,
    limit: 500,
  });

  const refresh = async () => {
    await Promise.all([refreshWorkspaces(), refreshTiles?.()]);
  };

  const handleCreate = () => {
    if (ownerId) setField("meta.ownerSubjectId", ownerId);
    openCreate();
  };

  return (
    <PageContainer>
      <PageHeader
        title={project ? project.display_name : t("projects.allTitle")}
        description={
          project ? t("projects.projectSubtitle") : t("projects.allSubtitle")
        }
      />

      {project && (
        <ProjectEditForm
          key={project.id}
          project={project}
          tileCount={tiles.length}
          onSaved={refresh}
          locale={locale}
          t={t}
        />
      )}

      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
        <span className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-foreground-lighter">
          {project ? project.display_name : t("projects.allWork")}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {loading || wsLoading ? t("projects.loading") : `${tiles.length} ${t("projects.items")}`}
        </span>
      </div>

      <div className="mt-4">
        {(loading || wsLoading) && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}
        {!loading && !wsLoading && (wsError || tileError) && (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-md border border-danger/30 bg-danger/5 px-4 py-4 text-sm text-foreground"
          >
            <p>{t("projects.loadError")}</p>
            <Button size="sm" radius="sm" variant="light" onClick={() => void refresh()}>
              {t("projects.retry")}
            </Button>
          </div>
        )}
        {!loading && !wsLoading && !wsError && !tileError && tiles.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-1 py-12 text-foreground-subtle">
            <p className="text-sm">{project ? t("projects.empty") : t("projects.emptyAll")}</p>
            <Button className="mt-4" size="sm" radius="sm" onClick={handleCreate}>
              {t("projects.create")}
            </Button>
          </div>
        )}
        {!loading && !wsLoading && !wsError && !tileError && tiles.length > 0 && (
          <div className="divide-y divide-border/40 overflow-hidden rounded-md border border-border bg-surface-1 shadow-xs">
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
  locale,
  t,
}: {
  project: Workspace;
  tileCount: number;
  onSaved: () => Promise<void>;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  // Keyed by project.id at the call site — state re-initializes on project change.
  // react-doctor-disable-next-line react-doctor/no-derived-useState
  const [name, setName] = useState(project.display_name);
  const [slug, setSlug] = useState(project.slug ?? "");
  const [color, setColor] = useState(project.color ?? "#6b7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  function save() {
    if (!name.trim()) {
      setError(t("projects.nameRequired"));
      setErrorDetail(null);
      return;
    }
    setSaving(true);
    setError(null);
    setErrorDetail(null);
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
        const detail = e instanceof Error ? e.message : String(e);
        setError(t("projects.saveError"));
        setErrorDetail(detail);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <section className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-border/40 bg-surface-1 p-4 md:grid-cols-3">
      <label htmlFor="project-name" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("projects.name")}</span>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label htmlFor="project-slug" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("projects.slug")}</span>
        <Input
          id="project-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          pattern="[a-z0-9-]+"
          maxLength={40}
          placeholder="my-project"
        />
      </label>
      <label htmlFor="project-color" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">{t("projects.color")}</span>
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
          {t("projects.savedMeta", {
            count: tileCount,
            date: new Date(project.created_at).toLocaleDateString(locale, { timeZone: "UTC" }),
          })}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-status-danger">{error}</span>}
          {errorDetail && <span className="text-status-danger">{errorDetail}</span>}
          <Button onClick={save} disabled={saving || !name.trim()} size="sm" radius="sm">
            <span aria-hidden="true">{saving ? t("projects.saving") : t("projects.save")}</span>
            <span className="sr-only">{saving ? "Saving" : "Save"}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
