"use client";

import { useEffect } from "react";
import { ensureAnonymousUser } from "@/lib/auth";

export function AuthBootstrap() {
  useEffect(() => {
    void ensureAnonymousUser();
  }, []);

  return null;
}
