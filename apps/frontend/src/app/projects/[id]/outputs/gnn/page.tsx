"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  Network,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { outputsApi, GNNStructure } from "@/lib/api/outputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function GNNPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<GNNStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await outputsApi.getGNNStructure(projectId);
        setData(result);
      } catch (e) {
        console.error("Failed to load GNN structure:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handleCopyCode = () => {
    const code = `import torch
from torch_geometric.data import Data

# Load graph structure
num_nodes = ${data?.num_nodes || 0}
num_features = ${data?.num_features || 0}

# Edge index (COO format)
edge_index = torch.tensor([
    ${JSON.stringify(data?.edge_index?.[0]?.slice(0, 10) || [])},  # source nodes
    ${JSON.stringify(data?.edge_index?.[1]?.slice(0, 10) || [])},  # target nodes
], dtype=torch.long)

# Node features (placeholder - load from actual data)
x = torch.randn(num_nodes, num_features)

# Create PyTorch Geometric Data object
data = Data(x=x, edge_index=edge_index)
print(f"Graph: {data.num_nodes} nodes, {data.num_edges} edges")`;

    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}/outputs`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Outputs
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">GNN Structure</h1>
          <p className="text-muted-foreground">
            Graph Neural Network ready data format
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {data.num_nodes} Nodes
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {data.num_edges} Edges
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {data.num_features} Features
          </Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Graph Statistics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-5 w-5" />
              Graph Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.num_nodes === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Network className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No GNN data available
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Nodes</p>
                    <p className="text-2xl font-bold">{data.num_nodes}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Edges</p>
                    <p className="text-2xl font-bold">{data.num_edges}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Features</p>
                    <p className="text-2xl font-bold">{data.num_features}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Avg Degree</p>
                    <p className="text-2xl font-bold">
                      {data.num_nodes > 0
                        ? ((data.num_edges * 2) / data.num_nodes).toFixed(1)
                        : 0}
                    </p>
                  </div>
                </div>

                {data.feature_names && data.feature_names.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Feature Names</p>
                    <div className="flex flex-wrap gap-1">
                      {data.feature_names.slice(0, 10).map((name) => (
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                      {data.feature_names.length > 10 && (
                        <Badge variant="secondary" className="text-xs">
                          +{data.feature_names.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PyTorch Geometric Code */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">PyTorch Geometric Usage</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCopyCode}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              <code>{`import torch
from torch_geometric.data import Data

# Load graph structure
num_nodes = ${data?.num_nodes || 0}
num_features = ${data?.num_features || 0}

# Edge index (COO format)
edge_index = torch.tensor([
    [...]  # source nodes
    [...]  # target nodes
], dtype=torch.long)

# Create Data object
data = Data(x=x, edge_index=edge_index)
print(f"Graph: {data.num_nodes} nodes")`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            About GNN Structure Format
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The GNN structure format is designed for use with Graph Neural Network
            frameworks like PyTorch Geometric and DGL.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground">Node Features</p>
              <p className="text-xs mt-1">
                Element properties encoded as feature vectors
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground">Edge Index</p>
              <p className="text-xs mt-1">
                COO format sparse adjacency representation
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground">Node IDs</p>
              <p className="text-xs mt-1">
                Mapping from graph indices to IFC GlobalIds
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
