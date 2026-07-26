"use client";

export interface BrowserCognitoSession {
  sub: string;
  exp: number;
  ownerId: string | null;
}

let cachedSession: BrowserCognitoSession | null = null;

export function clearCachedCognitoSession() {
  cachedSession = null;
}
