"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect } from "react";
import {
  profileQueryOptions,
  type SafeSession,
  safeSessionQueryOptions,
  sessionToAuthValue,
} from "@/lib/query/auth-query-options";

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
  const sessionQuery = useQuery(safeSessionQueryOptions);
  const profileQuery = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(sessionQuery.data),
  });

  useEffect(() => {
    if (sessionQuery.error || profileQuery.error) {
      if (typeof window !== "undefined") window.location.href = "/login?error=session_expired";
    }
  }, [profileQuery.error, sessionQuery.error]);

  const session = sessionToAuthValue(
    sessionQuery.data as SafeSession | null | undefined,
    profileQuery.data,
  );
  return (
    <AuthContext.Provider
      value={{
        session,
        loading: sessionQuery.isPending || (Boolean(sessionQuery.data) && profileQuery.isPending),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
