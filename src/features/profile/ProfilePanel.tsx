/**
 * ProfilePanel.tsx — Settings profile panel (v1/15 §4).
 *
 * Displays and edits the user's global profile (display_name, bio, accent_color).
 * Avatar upload is delegated to UploadAvatar.
 *
 * Phase A: skeleton. Full implementation in Phase X.
 */

import { useState } from "react";

interface Profile {
  kind: number;
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  accent_color: string | null;
  revision: number;
}

export function ProfilePanel() {
  const [profile, _setProfile] = useState<Profile | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars

  if (!profile) return <div>Profile not found</div>;

  return (
    <div className="profile-panel">
      <h2>Profile</h2>
      <div className="profile-field">
        <label htmlFor="display-name">Display Name</label>
        <input id="display-name" type="text" defaultValue={profile.display_name} />
      </div>
      <div className="profile-field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" defaultValue={profile.bio ?? ""} />
      </div>
      <div className="profile-field">
        <label htmlFor="accent-color">Accent Color</label>
        <input id="accent-color" type="color" defaultValue={profile.accent_color ?? "#3366ff"} />
      </div>
      {/* TODO: Avatar upload via UploadAvatar component */}
    </div>
  );
}
