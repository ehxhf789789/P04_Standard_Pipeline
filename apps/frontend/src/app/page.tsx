"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  CheckCircle,
  Database,
  FileCode,
  Network,
  Plus,
  Loader2,
} from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";

interface DashboardStats {
  totalProjects: number;
  totalFiles: number;
  completedRuns: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalFiles: 0,
    completedRuns: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await projectsApi.list();
        const projects = data.items || [];
        setRecentProjects(projects.slice(0, 5));

        const totalFiles = projects.reduce(
          (sum: number, p: Project) => sum + (p.ifc_file_count || 0),
          0
        );
        const completedRuns = projects.filter(
          (p: Project) => p.latest_run_status === "completed"
        ).length;

        setStats({
          totalProjects: data.total || projects.length,
          totalFiles,
          completedRuns,
        });
      } catch (e) {
        console.error("Failed to fetch dashboard data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            BIM-to-AI Pipeline: Convert IFC files to AI-ready formats
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={isLoading ? "..." : String(stats.totalProjects)}
          icon={<Box className="h-4 w-4" />}
        />
        <StatCard
          title="IFC Files"
          value={isLoading ? "..." : String(stats.totalFiles)}
          icon={<FileCode className="h-4 w-4" />}
        />
        <StatCard
          title="Completed Runs"
          value={isLoading ? "..." : String(stats.completedRuns)}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          title="AI Outputs Generated"
          value={isLoading ? "..." : String(stats.completedRuns * 4)}
          icon={<Network className="h-4 w-4" />}
        />
      </div>

      {/* Pipeline Overview */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Pipeline Stages</h2>
        <div className="grid gap-4 md:grid-cols-5">
          <StageCard
            number={1}
            title="Parse"
            description="IFC file parsing with IfcOpenShell"
          />
          <StageCard
            number={2}
            title="Validate"
            description="IDS rules from LOIN + bSDD"
          />
          <StageCard
            number={3}
            title="Enrich"
            description="bSDD standardization"
          />
          <StageCard
            number={4}
            title="Transform"
            description="4 AI output formats"
          />
          <StageCard
            number={5}
            title="Package"
            description="Summary & reports"
          />
        </div>
      </div>

      {/* Standards Reference */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Standards Referenced</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <StandardBadge code="ISO 16739-1:2024" name="IFC 4.3" />
          <StandardBadge code="ISO 7817-1:2024" name="LOIN" />
          <StandardBadge code="ISO 23386/23387" name="bSDD" />
          <StandardBadge code="IDS 1.0" name="Information Delivery Specification" />
        </div>
      </div>

      {/* Recent Projects */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <Link href="/projects" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Database className="mb-4 h-12 w-12 opacity-20" />
            <p>No projects yet</p>
            <p className="text-sm">Create a new project to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <h3 className="font-medium">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {project.ifc_file_count || 0} files
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      project.latest_run_status === "completed"
                        ? "bg-green-100 text-green-700"
                        : project.latest_run_status === "running"
                        ? "bg-blue-100 text-blue-700"
                        : project.latest_run_status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {project.latest_run_status || project.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StageCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4 text-center">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {number}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function StandardBadge({ code, name }: { code: string; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
      <span className="font-mono text-xs text-primary">{code}</span>
      <span className="text-sm">{name}</span>
    </div>
  );
}
