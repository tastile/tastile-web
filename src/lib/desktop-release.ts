type DesktopManifest = {
  latest_version?: string;
  download_url?: string;
  notes?: string;
};

export type DesktopReleaseInfo = {
  latestVersion: string;
  downloadUrl: string;
  notes: string;
};

export function getDesktopManifestUrl() {
  return process.env.TASTILE_DESKTOP_MANIFEST_URL?.trim() ?? "";
}

export async function fetchDesktopReleaseInfo(): Promise<DesktopReleaseInfo | null> {
  const manifestUrl = getDesktopManifestUrl();
  if (!manifestUrl) {
    return null;
  }

  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const manifest = (await response.json()) as DesktopManifest;
  const latestVersion = manifest.latest_version?.trim();
  const downloadUrl = manifest.download_url?.trim();
  if (!latestVersion || !downloadUrl) {
    return null;
  }

  try {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== "https:") {
      return null;
    }

    return {
      latestVersion,
      downloadUrl: parsed.toString(),
      notes: manifest.notes?.trim() ?? "",
    };
  } catch {
    return null;
  }
}
