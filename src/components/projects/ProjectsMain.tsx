"use client";

import { Button } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/PageHeader";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { updateWorkspace, useProjects, type Workspace } from "@/lib/hooks/use-projects";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { mapListViewToTile } from "@/lib/utils/map-list-view-to-tile";

export function ProjectsMain() {
  const searchParams = useSearchParams();
  const ownerId = searchParams.get("owner");
  const { workspaces, refresh, loading: wsLoading } = useProjects();
  const project = ownerId ? workspaces.find((w) => w.id === ownerId) : null;

  const { tiles, loading } = useTileList({
    ownerIds: ownerId ? [ownerId] : undefined,
    limit: 500,
  });

  return (
    <PageContainer>
      <PageHeader
        title={project ? project.display_name : "All Projects"}
        description={
          project ? "Tiles owned by this workspace" : "Select a project from the sidebar"
        }
      />

      {project && <ProjectEditForm project={project} tileCount={tiles.length} onSaved={refresh} />}

      <div className="mt-2 flex items-center justify-between border-b border-border/40 pb-3 text-xs text-foreground-subtle">
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
            "All project tiles"
          )}
        </span>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {loading || wsLoading ? "Loading..." : `${tiles.length} items found`}
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
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-1 py-12 text-foreground-subtle">
            <p className="text-sm">No tiles in this project.</p>
          </div>
        )}
        {!loading && tiles.length > 0 && (
          <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xs">
            {tiles.map((t) => (
              <TileCardCompact key={t.id} tile={mapListViewToTile(t)} listView={t} />
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
  const [name, setName] = useState(project.display_name);
  const [slug, setSlug] = useState(project.slug ?? "");
  const [color, setColor] = useState(project.color ?? "#6b7280");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) {
      setError("name required");
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
        <span className="font-semibold text-foreground-subtle">Name</span>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label htmlFor="project-slug" className="flex flex-col gap-1 text-xs">
        <span className="font-semibold text-foreground-subtle">Slug</span>
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
        <span className="font-semibold text-foreground-subtle">Color</span>
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
          <Button onClick={save} disabled={saving || !name.trim()} size="small">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
