"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload,
  ShieldCheck,
  Zap,
  Search,
  Plus,
  ArrowRight,
  PenTool,
  HardHat,
  Wrench,
  Box,
  FileCode,
  CheckCircle,
  Network,
  Loader2,
  Database,
  FileText,
  Layers,
} from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { useLanguageStore } from "@/store/languageStore";

export default function Dashboard() {
  const { t, lang } = useLanguageStore();
  const [stats, setStats] = useState({ projects: 0, files: 0, validated: 0, aiOutputs: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await projectsApi.list();
        const projects = data.items || [];
        setRecentProjects(projects.slice(0, 5));
        const totalFiles = projects.reduce((sum: number, p: Project) => sum + (p.file_count || p.ifc_file_count || 0), 0);
        const completed = projects.filter((p: Project) => p.latest_run_status === "completed").length;
        setStats({ projects: data.total || projects.length, files: totalFiles, validated: completed, aiOutputs: completed * 4 });
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  const actions = [
    {
      icon: Upload,
      title: t("dash.action.upload"),
      desc: t("dash.action.upload.desc"),
      href: "/projects",
      color: "from-blue-500 to-blue-600",
      bgHover: "hover:border-blue-300",
    },
    {
      icon: ShieldCheck,
      title: t("dash.action.validate"),
      desc: t("dash.action.validate.desc"),
      href: "/standards",
      color: "from-violet-500 to-purple-600",
      bgHover: "hover:border-violet-300",
    },
    {
      icon: Zap,
      title: t("dash.action.transform"),
      desc: t("dash.action.transform.desc"),
      href: "/ai-lake",
      color: "from-emerald-500 to-green-600",
      bgHover: "hover:border-emerald-300",
    },
    {
      icon: Search,
      title: t("dash.action.query"),
      desc: t("dash.action.query.desc"),
      href: "/ai-lake/query",
      color: "from-amber-500 to-orange-600",
      bgHover: "hover:border-amber-300",
    },
  ];

  const phases = [
    {
      icon: PenTool,
      title: t("lifecycle.design.title"),
      basis: t("lifecycle.design.basis"),
      desc: t("lifecycle.design.desc"),
      href: "/lifecycle/design",
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 border-blue-100",
      docs: lang === "ko"
        ? ["설계도면 (PDF)", "BIM 모델 (IFC)", "설계도서 (DOCX)", "물량산출서 (XLSX)"]
        : ["Design Drawings (PDF)", "BIM Model (IFC)", "Design Docs (DOCX)", "BOQ (XLSX)"],
    },
    {
      icon: HardHat,
      title: t("lifecycle.construction.title"),
      basis: t("lifecycle.construction.basis"),
      desc: t("lifecycle.construction.desc"),
      href: "/lifecycle/construction",
      gradient: "from-amber-500 to-orange-500",
      bg: "bg-amber-50 border-amber-100",
      docs: lang === "ko"
        ? ["시공상세도 (PDF)", "시공 BIM (IFC)", "공정보고서 (DOCX)", "진척현황 (XLSX)"]
        : ["Shop Drawings (PDF)", "As-Built BIM (IFC)", "Progress Report (DOCX)", "Schedule (XLSX)"],
    },
    {
      icon: Wrench,
      title: t("lifecycle.operation.title"),
      basis: t("lifecycle.operation.basis"),
      desc: t("lifecycle.operation.desc"),
      href: "/lifecycle/operation",
      gradient: "from-emerald-500 to-green-600",
      bg: "bg-emerald-50 border-emerald-100",
      docs: lang === "ko"
        ? ["점검보고서 (PDF)", "유지관리 BIM (IFC)", "보수이력 (XLSX)", "매뉴얼 (DOCX)"]
        : ["Inspection Report (PDF)", "O&M BIM (IFC)", "Repair History (XLSX)", "Manual (DOCX)"],
    },
  ];

  const pipelineSteps = [
    { icon: Upload, name: t("pipeline.ingest"), desc: t("pipeline.ingest.desc"), std: "ISO 19650 CDE" },
    { icon: FileText, name: t("pipeline.parse"), desc: t("pipeline.parse.desc"), std: "ISO 16739-1" },
    { icon: ShieldCheck, name: t("pipeline.validate"), desc: t("pipeline.validate.desc"), std: "IDS 1.0 + LOIN" },
    { icon: Layers, name: t("pipeline.enrich"), desc: t("pipeline.enrich.desc"), std: "bSDD (ISO 23386)" },
    { icon: Zap, name: t("pipeline.transform"), desc: t("pipeline.transform.desc"), std: "KG / Embedding" },
    { icon: Database, name: t("pipeline.aiLake"), desc: t("pipeline.aiLake.desc"), std: "Vector + Graph DB" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* === SECTION 1: Quick Actions === */}
      <div>
        <h1 className="text-2xl font-bold mb-1">{t("dash.hero.title")}</h1>
        <p className="text-sm text-muted-foreground mb-4">{t("app.description")}</p>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className={`group rounded-xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${action.bgHover}`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} text-white mb-3`}>
                <action.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{action.desc}</p>
              <div className="mt-3 flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {lang === "ko" ? "바로가기" : "Go"} <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* === SECTION 2: Stats === */}
      <div className="grid gap-3 grid-cols-4">
        <StatCard title={t("dash.stat.projects")} value={isLoading ? "..." : stats.projects} icon={<Box className="h-4 w-4" />} />
        <StatCard title={t("dash.stat.files")} value={isLoading ? "..." : stats.files} icon={<FileCode className="h-4 w-4" />} />
        <StatCard title={t("dash.stat.validated")} value={isLoading ? "..." : stats.validated} icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard title={t("dash.stat.aiOutputs")} value={isLoading ? "..." : stats.aiOutputs} icon={<Network className="h-4 w-4" />} />
      </div>

      {/* === SECTION 3: Lifecycle Phases === */}
      <div>
        <h2 className="text-lg font-bold mb-1">{t("dash.lifecycle.title")}</h2>
        <p className="text-xs text-muted-foreground mb-3">{t("dash.lifecycle.desc")}</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {phases.map((phase) => (
            <Link
              key={phase.title}
              href={phase.href}
              className={`group rounded-xl border ${phase.bg} p-5 transition-all hover:shadow-md`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${phase.gradient} text-white`}>
                  <phase.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{phase.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">{phase.basis}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{phase.desc}</p>
              <div className="flex flex-wrap gap-1">
                {phase.docs.map((doc) => (
                  <span key={doc} className="text-[10px] bg-white/70 rounded px-1.5 py-0.5 text-muted-foreground">
                    {doc}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* === SECTION 4: Pipeline === */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold mb-1">{t("dash.pipeline.title")}</h2>
        <p className="text-xs text-muted-foreground mb-4">{t("dash.pipeline.desc")}</p>
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {pipelineSteps.map((step, idx) => (
            <div key={step.name} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="rounded-lg border bg-background p-3 flex-1 min-w-[100px]">
                <div className="flex items-center gap-2 mb-1">
                  <step.icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold truncate">{step.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{step.desc}</p>
                <p className="text-[9px] font-mono text-primary/60 mt-1">{step.std}</p>
              </div>
              {idx < pipelineSteps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* === SECTION 5: Recent Projects === */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{t("dash.recent.title")}</h2>
          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-xs text-primary hover:underline">{t("dash.recent.viewAll")}</Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" />
              {t("dash.newProject")}
            </Link>
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Database className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">{t("dash.recent.empty")}</p>
            <p className="text-xs mt-1">{t("dash.recent.create")}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-medium">{project.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {project.file_count || project.ifc_file_count || 0} {t("dash.files")}
                  </p>
                </div>
                <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                  project.latest_run_status === "completed" ? "bg-green-100 text-green-700"
                    : project.latest_run_status === "running" ? "bg-blue-100 text-blue-700"
                    : project.latest_run_status === "failed" ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {project.latest_run_status || project.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">{icon}{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
