"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  Table,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { outputsApi, TabularPreview } from "@/lib/api/outputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TabularPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<TabularPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await outputsApi.getTabular(projectId, undefined, 100);
        setData(result);
      } catch (e) {
        console.error("Failed to load tabular data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.rows.length / pageSize) : 0;
  const paginatedRows = data?.rows.slice((page - 1) * pageSize, page * pageSize) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}/outputs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Outputs
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Tabular Data</h1>
          <p className="text-muted-foreground">
            Structured dataset of BIM elements for ML training
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Parquet
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {data.total_rows} Rows
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {data.total_columns} Columns
          </Badge>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Table className="h-5 w-5" />
              Dataset Preview
            </CardTitle>
            {data && data.rows.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!data || data.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Table className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="font-medium">No tabular data available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Run the pipeline to generate tabular output
              </p>
            </div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    {data.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {paginatedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {data.columns.map((col) => (
                        <td
                          key={col}
                          className="whitespace-nowrap px-4 py-2 text-sm"
                        >
                          {typeof row[col] === "object"
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Info */}
      {data && data.columns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Column Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {data.columns.map((col) => (
                <div
                  key={col}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <Badge variant="outline" className="font-mono text-xs">
                    {col}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
