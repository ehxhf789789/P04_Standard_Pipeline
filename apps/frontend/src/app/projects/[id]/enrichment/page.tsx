"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Search,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { enrichmentApi, EnrichmentSummary, ElementEnrichment, PropertyMapping } from "@/lib/api/enrichment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function EnrichmentPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const [mappings, setMappings] = useState<PropertyMapping[]>([]);
  const [elements, setElements] = useState<ElementEnrichment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("mappings");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, mappingsData, resultsData] = await Promise.all([
          enrichmentApi.getSummary(projectId),
          enrichmentApi.getMappings(projectId),
          enrichmentApi.getResults(projectId),
        ]);
        setSummary(summaryData);
        setMappings(Array.isArray(mappingsData) ? mappingsData : []);
        setElements(resultsData.elements || resultsData || []);
      } catch (e) {
        console.error("Failed to load enrichment data:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const filteredMappings = mappings.filter((m) =>
    !search ||
    m.original_name.toLowerCase().includes(search.toLowerCase()) ||
    m.standardized_name?.toLowerCase().includes(search.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold tracking-tight">Enrichment Results</h1>
        <p className="text-muted-foreground">
          bSDD-based property standardization (ISO 23386/23387)
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Enriched Elements</div>
              <div className="mt-1 text-3xl font-bold text-green-500">
                {summary.enriched_count}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {summary.total_elements} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Partial</div>
              <div className="mt-1 text-3xl font-bold text-yellow-500">
                {summary.partial_count}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Some properties mapped
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Properties Mapped</div>
              <div className="mt-1 text-3xl font-bold text-blue-500">
                {summary.mapped_properties}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {summary.total_properties} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">bSDD Classifications</div>
              <div className="mt-1 text-3xl font-bold">
                {summary.bsdd_classifications_used.length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unique classifications used
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mapping Rate */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property Mapping Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mapped Properties</span>
                <span className="font-medium">
                  {((summary.mapped_properties / summary.total_properties) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={(summary.mapped_properties / summary.total_properties) * 100}
                className="h-3"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mappings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Property Mappings</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                className="w-64 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="mappings">Property Mappings</TabsTrigger>
              <TabsTrigger value="elements">Elements</TabsTrigger>
            </TabsList>

            <TabsContent value="mappings" className="mt-4">
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Original Property</th>
                      <th className="px-4 py-3 text-center">
                        <ArrowRight className="mx-auto h-4 w-4" />
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Standardized (bSDD)</th>
                      <th className="px-4 py-3 text-left font-medium">Confidence</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.slice(0, 50).map((mapping, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">
                          {mapping.original_name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Sparkles className="mx-auto h-4 w-4 text-primary" />
                        </td>
                        <td className="px-4 py-3">
                          {mapping.standardized_name ? (
                            <div>
                              <span className="font-mono text-xs">
                                {mapping.standardized_name}
                              </span>
                              {mapping.bsdd_uri && (
                                <a
                                  href={mapping.bsdd_uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 inline-flex items-center text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {mapping.confidence !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={mapping.confidence * 100}
                                className="h-1.5 w-16"
                              />
                              <span className="text-xs text-muted-foreground">
                                {(mapping.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              mapping.status === "mapped"
                                ? "success"
                                : mapping.status === "manual"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {mapping.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMappings.length > 50 && (
                  <p className="border-t py-3 text-center text-sm text-muted-foreground">
                    Showing 50 of {filteredMappings.length} mappings
                  </p>
                )}
                {filteredMappings.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    No mappings found
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="elements" className="mt-4">
              <div className="space-y-2">
                {elements.slice(0, 30).map((element) => (
                  <ElementCard key={element.element_id} element={element} />
                ))}
                {elements.length > 30 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Showing 30 of {elements.length} elements
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* bSDD Classifications Used */}
      {summary && summary.bsdd_classifications_used.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">bSDD Classifications Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.bsdd_classifications_used.map((cls) => (
                <Badge key={cls} variant="secondary">
                  {cls}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ElementCard({ element }: { element: ElementEnrichment }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-md border">
      <button
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {element.enrichment_status === "enriched" ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-yellow-500" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{element.global_id}</span>
              <Badge variant="outline" className="text-xs">
                {element.ifc_class}
              </Badge>
              {element.standardized_class && element.standardized_class !== element.original_class && (
                <>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    {element.standardized_class}
                  </Badge>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {element.property_mappings.filter((m) => m.status === "mapped").length} of{" "}
              {element.property_mappings.length} properties mapped
            </p>
          </div>
        </div>
        <Badge
          variant={
            element.enrichment_status === "enriched"
              ? "success"
              : element.enrichment_status === "partial"
              ? "warning"
              : "secondary"
          }
        >
          {element.enrichment_status}
        </Badge>
      </button>

      {isExpanded && element.property_mappings.length > 0 && (
        <div className="border-t bg-muted/30 p-3">
          <div className="space-y-1.5">
            {element.property_mappings.slice(0, 10).map((mapping, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-muted-foreground">
                  {mapping.original_name}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={cn(
                  "truncate",
                  mapping.standardized_name ? "font-medium" : "text-muted-foreground"
                )}>
                  {mapping.standardized_name || "(unmapped)"}
                </span>
              </div>
            ))}
            {element.property_mappings.length > 10 && (
              <p className="text-xs text-muted-foreground">
                +{element.property_mappings.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
