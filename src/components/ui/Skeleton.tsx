"use client";

import { Skeleton as MantineSkeleton } from "@mantine/core";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <MantineSkeleton radius="md" height="auto" className={className} aria-label="Loading content" />
  );
}
