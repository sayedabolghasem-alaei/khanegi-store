"use client";
// Tiny hash router — the sandbox exposes a single route (/), so all
// navigation inside the store happens under #/... hash URLs (persistable,
// shareable, back/forward button friendly).

import { useCallback, useSyncExternalStore } from "react";

export interface HashLocation {
  path: string; // e.g. "/product/snowa-nf2150"
  query: URLSearchParams;
  raw: string; // full hash without '#'
}

function parseHash(): HashLocation {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return { path: normalized.replace(/\/+$/, "") || "/", query: new URLSearchParams(qs ?? ""), raw };
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}

// useSyncExternalStore requires a stable snapshot between renders — cache by raw hash.
let cachedRaw: string | null = null;
let cachedSnapshot: HashLocation = { path: "/", query: new URLSearchParams(""), raw: "/" };
const SERVER_SNAPSHOT: HashLocation = { path: "/", query: new URLSearchParams(""), raw: "/" };

function getSnapshot(): HashLocation {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = parseHash();
  }
  return cachedSnapshot;
}

/** Subscribe to hash location changes. */
export function useHashLocation(): HashLocation {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/** Programmatic navigation. `to` should start with "/" (hash is added). */
export function navigate(to: string, opts?: { replace?: boolean; keepScroll?: boolean }) {
  const target = `#${to.startsWith("/") ? to : `/${to}`}`;
  if (opts?.replace) {
    const url = new URL(window.location.href);
    url.hash = target;
    window.history.replaceState(null, "", url.toString());
    listeners.forEach((l) => l());
  } else {
    window.location.hash = target;
  }
  if (!opts?.keepScroll) {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }
}

export function useNavigate() {
  return useCallback((to: string, opts?: { replace?: boolean; keepScroll?: boolean }) => navigate(to, opts), []);
}

/** Build an href for <a> links (keeps middle-click/open-in-new-tab working). */
export function href(to: string): string {
  return `#${to.startsWith("/") ? to : `/${to}`}`;
}
