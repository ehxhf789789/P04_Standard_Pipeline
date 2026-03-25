"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { AuthGuard } from "@/components/auth/AuthGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  // Batch hydrate all stores in one pass to avoid multiple re-renders
  useEffect(() => {
    // Apply theme BEFORE React hydration to prevent flash
    try {
      const stored = localStorage.getItem("theme-preference");
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.isDark) document.documentElement.classList.add("dark");
      }
    } catch {}

    // Rehydrate all stores in a single tick
    useLanguageStore.persist.rehydrate();
    useAuthStore.persist.rehydrate();
    useThemeStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  // Prevent rendering children until stores are ready — avoids flash/mismatch
  if (!hydrated) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>{children}</AuthGuard>
    </QueryClientProvider>
  );
}
