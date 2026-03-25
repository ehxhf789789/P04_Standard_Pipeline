"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, FolderOpen, PenTool, HardHat, Wrench, Database,
  ShieldCheck, Search, Settings, Zap, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/languageStore";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, lang } = useLanguageStore();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  if (pathname === "/login") return null;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-12 items-center justify-between border-b dark:border-slate-800 px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="leading-none">
            <span className="font-black text-[13px] tracking-tight">BIM-Vortex</span>
            <span className="block text-[7px] font-medium text-muted-foreground tracking-widest uppercase">{t("app.subtitle")}</span>
          </div>
        </div>
        {/* Mobile close button */}
        {onMobileClose && (
          <button onClick={onMobileClose} className="lg:hidden p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-4">
        <div className="space-y-0.5">
          <NavLink href="/" icon={Home} label={t("nav.dashboard")} active={isActive("/")} />
        </div>

        <NavSection label={t("nav.lifecycle")}>
          <NavLink href="/lifecycle/design" icon={PenTool} label={t("nav.design")} active={isActive("/lifecycle/design")} accent="blue" />
          <NavLink href="/lifecycle/construction" icon={HardHat} label={t("nav.construction")} active={isActive("/lifecycle/construction")} accent="amber" />
          <NavLink href="/lifecycle/operation" icon={Wrench} label={t("nav.operation")} active={isActive("/lifecycle/operation")} accent="emerald" />
          <NavLink href="/lifecycle/unassigned" icon={FolderOpen} label={lang === "ko" ? "미분류" : "Unassigned"} active={isActive("/lifecycle/unassigned")} />
        </NavSection>

        <NavSection label={t("nav.data")}>
          <NavLink href="/ai-lake" icon={Database} label={t("nav.aiLake")} active={isActive("/ai-lake") && !pathname.includes("query")} />
          <NavLink href="/ai-lake/query" icon={Search} label={t("nav.query")} active={pathname === "/ai-lake/query"} />
          <NavLink href="/standards" icon={ShieldCheck} label={t("nav.standards")} active={isActive("/standards")} />
        </NavSection>
      </nav>

      <div className="border-t dark:border-slate-800 p-1.5">
        <NavLink href="/settings" icon={Settings} label={t("nav.settings")} active={isActive("/settings")} />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onMobileClose} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 z-50 flex flex-col shadow-xl lg:hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 px-2.5 text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">{label}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ href, icon: Icon, label, active, accent }: {
  href: string; icon: React.ElementType; label: string; active: boolean; accent?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-slate-900 dark:bg-amber-500/20 text-white dark:text-amber-300"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 flex-shrink-0",
        !active && accent === "blue" && "text-blue-500",
        !active && accent === "amber" && "text-amber-500",
        !active && accent === "emerald" && "text-emerald-500",
      )} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
