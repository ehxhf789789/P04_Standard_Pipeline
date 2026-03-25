"use client";

import { useState, useCallback, memo } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggle = useCallback(() => setMobileSidebarOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setMobileSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={handleClose} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onToggleMobileSidebar={handleToggle} />
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 pb-20">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}

const AppFooter = memo(function AppFooter() {
  return (
    <footer className="border-t bg-white dark:bg-slate-900 dark:border-slate-800 px-4 lg:px-6 py-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-amber-500 tracking-tight leading-none">KICT</span>
            <span className="text-[7px] text-muted-foreground leading-tight">한국건설기술연구원</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[10px] text-muted-foreground">Korea Institute of Civil Engineering and Building Technology</p>
            <p className="text-[9px] text-muted-foreground/60">© 2026 KICT. BIM-Vortex AI Standards Pipeline Platform</p>
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground/50 text-right">
          <p>Powered by openBIM Standards</p>
          <p>ISO 19650 · IFC · IDS · LOIN · bSDD · BCF</p>
        </div>
      </div>
    </footer>
  );
});
