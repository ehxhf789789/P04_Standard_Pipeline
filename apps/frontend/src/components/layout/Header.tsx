"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Moon, Sun, User, LogOut, Settings, Globe, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLanguageStore } from "@/store/languageStore";
import { useThemeStore } from "@/store/themeStore";
import { Button } from "@/components/ui/button";

export function Header({ onToggleMobileSidebar }: { onToggleMobileSidebar?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { lang, setLang, t } = useLanguageStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (pathname === "/login") return null;

  const toggleLang = () => setLang(lang === "ko" ? "en" : "ko");

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="flex h-12 items-center justify-between border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-4 lg:px-5">
      {/* Left */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {/* Mobile menu toggle */}
        <button onClick={onToggleMobileSidebar} className="lg:hidden p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
          <Menu className="h-4 w-4" />
        </button>
        <span className="font-medium text-foreground">BIM-Vortex</span>
        <span className="text-muted-foreground/30 hidden sm:inline">/</span>
        <span className="hidden sm:inline">{t("app.subtitle")}</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleLang}
          className="flex h-8 items-center gap-1 rounded-md px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px]">{lang === "ko" ? "KR" : "EN"}</span>
        </button>

        <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
          <Bell className="h-3.5 w-3.5" />
        </button>

        {isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex h-8 items-center gap-2 rounded-md px-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {(user?.name || "U")[0]}
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 hidden sm:inline">{user?.name || "User"}</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 py-1 shadow-lg z-50">
                <div className="border-b dark:border-slate-700 px-3 py-2">
                  <p className="text-xs font-medium">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <LogOut className="h-3.5 w-3.5" /> {lang === "ko" ? "로그아웃" : "Sign Out"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login">
            <Button variant="default" size="sm" className="h-7 text-[11px] bg-amber-500 hover:bg-amber-600">
              {t("nav.signIn")}
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
