"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { pickDisplayLabel } from "@/lib/auth/display-label";

interface AuthSession {
  sub: string;
  ownerId: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>({ session: null, loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
        if (!sessionRes.ok) {
          // 401 means the session is invalid — redirect to login
          if (sessionRes.status === 401 && typeof window !== "undefined") {
            window.location.href = "/login?error=session_expired";
            return;
          }
          if (alive) setValue({ session: null, loading: false });
          return;
        }
        const sessionData = (await sessionRes.json()) as {
          sub?: string;
          owner_id?: string | null;
        };
        if (!sessionData.sub) {
          if (alive) setValue({ session: null, loading: false });
          return;
        }

        // Fetch profile for display name / email
        let email: string | null = null;
        let displayName: string | null = null;
        let avatarUrl: string | null = null;
        try {
          const meRes = await fetch("/api/me", { cache: "no-store" });
          if (meRes.ok) {
            const meData = (await meRes.json()) as {
              email?: string | null;
              display_name?: string | null;
              avatar_url?: string | null;
            };
            email = meData.email ?? null;
            displayName = meData.display_name ?? null;
            avatarUrl = meData.avatar_url ?? null;
          }
        } catch {
          // Profile fetch is best-effort; session data is sufficient
        }

        if (alive) {
          setValue({
            session: {
              sub: sessionData.sub,
              ownerId: sessionData.owner_id ?? null,
              email,
              displayName: pickDisplayLabel({
                displayName,
                email,
                ownerId: sessionData.owner_id ?? null,
                sub: sessionData.sub,
              }),
              avatarUrl,
            },
            loading: false,
          });
        }
      } catch {
        if (alive) setValue({ session: null, loading: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
