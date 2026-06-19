"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Project {
  id: string;
  name: string;
  labelFilter: string[];
  color: string;
}

interface ProjectsState {
  projects: Record<string, Project>;
  create: (name: string, labelFilter: string[], color: string) => void;
  update: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  remove: (id: string) => void;
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: {},
      create: (name, labelFilter, color) => {
        const id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ projects: { ...s.projects, [id]: { id, name, labelFilter, color } } }));
      },
      update: (id, patch) =>
        set((s) => {
          const existing = s.projects[id];
          if (!existing) return s;
          return { projects: { ...s.projects, [id]: { ...existing, ...patch } } };
        }),
      remove: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.projects;
          return { projects: rest };
        }),
    }),
    { name: "tastile.projects" },
  ),
);
