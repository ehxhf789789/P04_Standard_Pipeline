"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Loader2,
  Search,
} from "lucide-react";
import { validationApi, ValidationSummary, ElementValidation } from "@/lib/api/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function ValidationPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [elements, setElements] = useState<ElementValidation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "warning">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, resultsData] = await Promise.all([
          validationApi.getSummary(projectId),
          validationApi.getResults(projectId),
        ]);
        setSummary(summaryData);
        setElements(resultsData.elements || resultsData || []);
      } catch (e) {
        console.error("Failed to load validation data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const filteredElements = elements.filter((el) => {
    const matchesFilter = filter === "all" || el.status === filter;
    const matchesSearch =
      !search ||
      el.name?.toLowerCase().includes(search.toLowerCase()) ||
      el.global_id.toLowerCase().includes(search.toLowerCase()) ||
      el.ifc_class.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
      <div className="space-y-1">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Validation Results</h1>
        <p className="text-muted-foreground">
          IDS/LOIN validation results based on ISO 7817-1 and bSDD
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            title="Pass Rate"
            value={`${summary.pass_rate.toFixed(1)}%`}
            subtitle={`${summary.passed} of ${summary.total_elements} elements`}
            color="green"
          />
          <SummaryCard
            title="Failed"
            value={summary.failed.toString()}
            subtitle="Elements with failures"
            color="red"
          />
          <SummaryCard
            title="Warnings"
            value={summary.warnings.toString()}
            subtitle="Elements with warnings"
            color="yellow"
          />
          <SummaryCard
            title="Rules Applied"
            value={summary.rules_applied.toString()}
            subtitle="IDS validation rules"
            color="blue"
          />
        </div>
      )}

      {/* Compliance Overview */}
      {summary && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">LOIN Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Overall Compliance</span>
                  <span className="font-medium">{summary.loin_compliance.overall}%</span>
                </div>
                <Progress value={summary.loin_compliance.overall} className="h-2" />
              </div>
              <div className="space-y-2">
                {Object.entries(summary.loin_compliance.by_category).map(([cat, val]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{cat}</span>
                    <span>{val}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">bSDD Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Overall Compliance</span>
                  <span className="font-medium">{summary.bsdd_compliance.overall}%</span>
                </div>
                <Progress value={summary.bsdd_compliance.overall} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mapped Properties</span>
                  <span>{summary.bsdd_compliance.mapped_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unmapped Properties</span>
                  <span>{summary.bsdd_compliance.unmapped_count}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Elements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Validation Details</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search elements..."
                  className="w-64 pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">All ({elements.length})</TabsTrigger>
              <TabsTrigger value="pass">
                Pass ({elements.filter((e) => e.status === "pass").length})
              </TabsTrigger>
              <TabsTrigger value="fail">
                Fail ({elements.filter((e) => e.status === "fail").length})
              </TabsTrigger>
              <TabsTrigger value="warning">
                Warning ({elements.filter((e) => e.status === "warning").length})
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-2">
              {filteredElements.slice(0, 50).map((element) => (
                <ElementRow key={element.element_id} element={element} />
              ))}
              {filteredElements.length > 50 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Showing 50 of {filteredElements.length} elements
                </p>
              )}
              {filteredElements.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No elements found
                </p>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "green" | "red" | "yellow" | "blue";
}) {
  const colorClasses = {
    green: "text-green-500",
    red: "text-red-500",
    yellow: "text-yellow-500",
    blue: "text-blue-500",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className={cn("mt-1 text-3xl font-bold", colorClasses[color])}>
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ElementRow({ element }: { element: ElementValidation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const StatusIcon = {
    pass: <CheckCircle className="h-4 w-4 text-green-500" />,
    fail: <XCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  }[element.status];

  return (
    <div className="rounded-md border">
      <button
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {StatusIcon}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{element.name || element.global_id}</span>
              <Badge variant="outline" className="text-xs">
                {element.ifc_class}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {element.global_id} • {element.checks.length} checks
            </p>
          </div>
        </div>
        <Badge
          variant={
            element.status === "pass"
              ? "success"
              : element.status === "fail"
              ? "destructive"
              : "warning"
          }
        >
          {element.status}
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/30 p-3">
          <div className="space-y-2">
            {element.checks.map((check, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {check.result === "pass" ? (
                  <CheckCircle className="mt-0.5 h-3 w-3 text-green-500" />
                ) : check.result === "fail" ? (
                  <XCircle className="mt-0.5 h-3 w-3 text-red-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 text-yellow-500" />
                )}
                <div>
                  <span className="font-medium">{check.check_name}</span>
                  {check.message && (
                    <p className="text-muted-foreground">{check.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
