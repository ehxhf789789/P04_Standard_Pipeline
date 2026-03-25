"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const PUBLIC_PATHS = ["/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip auth check for public paths
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }

    // If not authenticated, redirect to login
    if (!isAuthenticated && !isLoading) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Public paths - always render
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // Authenticated - render children
  if (isAuthenticated && checked) {
    return <>{children}</>;
  }

  // Loading state
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black">BIM-Vortex</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-amber-500 mx-auto" />
      </div>
    </div>
  );
}
