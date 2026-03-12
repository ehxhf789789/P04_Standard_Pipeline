"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Box, Loader2, FileCode, CheckCircle, Clock } from "lucide-react";
import { projectsApi, Project } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectsApi.list();
        setProjects(data.items || data || []);
      } catch (e) {
        setError("Failed to load projects");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your BIM-to-AI pipeline projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Project List */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Box className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="font-medium">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start processing IFC files
            </p>
            <Link href="/projects/new" className="mt-4">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const statusVariant = {
    active: "default",
    processing: "secondary",
    completed: "success",
    error: "destructive",
  }[project.status] as "default" | "secondary" | "success" | "destructive";

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-1 text-lg">
              {project.name}
            </CardTitle>
            <Badge variant={statusVariant || "outline"}>{project.status}</Badge>
          </div>
          {project.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileCode className="h-4 w-4" />
              <span>{project.ifc_file_count} files</span>
            </div>
            {project.latest_run_status && (
              <div className="flex items-center gap-1">
                {project.latest_run_status === "completed" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <span className="capitalize">{project.latest_run_status}</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
