/**
 * UploadAvatar.tsx — Avatar upload component (v1/15 §3).
 *
 * 3-step flow: pick file → upload to S3 via presigned URL → commit.
 *
 * Phase A: skeleton. Full implementation with client-side resize in Phase X.
 */

import type React from "react";
import { useCallback, useState } from "react";

interface UploadState {
  step: "idle" | "picking" | "uploading" | "committing" | "done";
  progress?: number;
  error?: string;
}

export function UploadAvatar({ onUploaded }: { onUploaded?: (url: string) => void }) {
  const [state, setState] = useState<UploadState>({ step: "idle" });

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setState({ step: "picking" });

      try {
        // TODO: Client-side resize to 256/64/32 WebP variants
        // TODO: POST /v1/uploads/avatar → get presigned URL
        // TODO: PUT to S3
        // TODO: POST /v1/uploads/avatar/{id}/commit
        setState({ step: "done" });
        onUploaded?.("https://cdn.tastile.example/avatar/v1/committed/0/self/r1/source.webp");
      } catch (err) {
        setState({ step: "idle", error: String(err) });
      }
    },
    [onUploaded],
  );

  return (
    <div className="upload-avatar">
      <input type="file" accept="image/webp,image/png,image/jpeg" onChange={handleFilePick} />
      {state.step === "uploading" && <div>Uploading...</div>}
      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
}
