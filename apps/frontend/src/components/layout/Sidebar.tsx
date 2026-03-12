"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Home, Network, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Projects", href: "/projects", icon: Box },
];

const pipelineStages = [
  { name: "Parse", description: "IFC → Structured Objects" },
  { name: "Validate", description: "IDS + LOIN Rules" },
  { name: "Enrich", description: "bSDD Standardization" },
  { name: "Transform", description: "AI Output Formats" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Network className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-semibold">BIM-to-AI</span>
          <span className="block text-xs text-muted-foreground">Pipeline</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Pipeline Stages (Info Only) */}
        <div className="pt-6">
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline Stages
          </h3>
          <div className="space-y-1">
            {pipelineStages.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
