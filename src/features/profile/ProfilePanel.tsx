/**
 * ProfilePanel.tsx — Settings profile panel (v1/15 §4).
 *
 * Displays and edits the user's global profile (display_name, bio, accent_color).
 * Avatar upload is delegated to UploadAvatar.
 *
 * Phase A: skeleton. Full implementation in Phase X.
 */

import React, { useState, useEffect } from "react";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: fetch from GET /v1/owners/0/{id}/profile
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>Profile not found</div>;

  return (
    <div className="profile-panel">
      <h2>Profile</h2>
      <div className="profile-field">
        <label>Display Name</label>
        <input type="text" defaultValue={profile.display_name} />
      </div>
      <div className="profile-field">
        <label>Bio</label>
        <textarea defaultValue={profile.bio ?? ""} />
      </div>
      <div className="profile-field">
        <label>Accent Color</label>
        <input type="color" defaultValue={profile.accent_color ?? "#3366ff"} />
      </div>
      {/* TODO: Avatar upload via UploadAvatar component */}
    </div>
  );
}
