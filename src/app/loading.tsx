import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <output className="flex min-h-dvh items-center justify-center bg-background text-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-foreground-subtle" />
    </output>
  );
}
