"use client";

export interface BrowserCognitoSession {
  sub: string;
  exp: number;
  ownerId: string | null;
}

let _cachedSession: BrowserCognitoSession | null = null;

export function clearCachedCognitoSession() {
  _cachedSession = null;
}
