import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

const DISPLAY_NAME_STORAGE_KEY = "blossom:displayName";

export async function ensureAnonymousUser() {
  if (!auth) {
    return null;
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function getLocalDisplayName() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "";
}

export function setLocalDisplayName(displayName: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (displayName.trim()) {
    window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName.trim());
    return;
  }

  window.localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
}
