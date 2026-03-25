import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "BIM-Vortex | AI Standards Pipeline",
  description: "Construction lifecycle document management with international standards-based validation and AI-ready data transformation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto">
                <div className="p-6 pb-20">
                  {children}
                </div>
                {/* KICT Footer */}
                <footer className="border-t bg-white px-6 py-4">
                  <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-amber-500 tracking-tight leading-none">KICT</span>
                        <span className="text-[7px] text-muted-foreground leading-tight">한국건설기술연구원</span>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Korea Institute of Civil Engineering and Building Technology
                        </p>
                        <p className="text-[9px] text-muted-foreground/60">
                          © 2026 KICT. BIM-Vortex AI Standards Pipeline Platform
                        </p>
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground/50 text-right">
                      <p>Powered by openBIM Standards</p>
                      <p>ISO 19650 · IFC · IDS · LOIN · bSDD · BCF</p>
                    </div>
                  </div>
                </footer>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
