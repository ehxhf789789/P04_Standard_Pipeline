"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  Box,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Info,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useIFCViewer } from "@/hooks/useIFCViewer";
import { IFCElement, IFCPropertySet } from "@/lib/viewer/IFCLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IFCViewerProps {
  projectId: string;
  fileUrl?: string;
}

export function IFCViewer({ projectId, fileUrl }: IFCViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedProperties, setSelectedProperties] = useState<IFCPropertySet[]>([]);
  const [visibilityMap, setVisibilityMap] = useState<Map<number, boolean>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");

  const handleElementSelect = useCallback(
    (element: IFCElement | null, properties: IFCPropertySet[]) => {
      setSelectedProperties(properties);
    },
    []
  );

  const {
    isLoading,
    isLoaded,
    error,
    elements,
    selectedElement,
    loadFile,
    loadUrl,
    selectElement,
    setVisibility,
    fitToView,
    resetView,
    zoomIn,
    zoomOut,
  } = useIFCViewer({
    containerRef: containerRef as React.RefObject<HTMLElement>,
    onElementSelect: handleElementSelect,
  });

  // Load file from URL if provided
  useEffect(() => {
    if (fileUrl) {
      loadUrl(fileUrl);
    }
  }, [fileUrl, loadUrl]);

  // Initialize visibility map
  useEffect(() => {
    const map = new Map<number, boolean>();
    elements.forEach((el) => map.set(el.expressID, true));
    setVisibilityMap(map);
  }, [elements]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await loadFile(file);
      }
    },
    [loadFile]
  );

  const toggleVisibility = useCallback(
    (expressID: number) => {
      const currentVisibility = visibilityMap.get(expressID) ?? true;
      const newVisibility = !currentVisibility;
      setVisibility(expressID, newVisibility);
      setVisibilityMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(expressID, newVisibility);
        return newMap;
      });
    },
    [visibilityMap, setVisibility]
  );

  const filteredElements = elements.filter((el) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      el.name?.toLowerCase().includes(term) ||
      el.globalId.toLowerCase().includes(term) ||
      el.type.toLowerCase().includes(term)
    );
  });

  // Group elements by type
  const elementsByType = filteredElements.reduce((acc, el) => {
    if (!acc[el.type]) acc[el.type] = [];
    acc[el.type].push(el);
    return acc;
  }, {} as Record<string, IFCElement[]>);

  return (
    <div className="flex h-full gap-4">
      {/* 3D Viewer */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={resetView} title="Reset View">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={fitToView} title="Fit to View">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                좌클릭: 회전 | 우클릭: 이동 | 스크롤: 확대/축소
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isLoaded && (
                <Badge variant="secondary" className="text-xs">
                  {elements.length} elements
                </Badge>
              )}
              {!isLoaded && !isLoading && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".ifc"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Load IFC
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>

          {/* 3D Canvas */}
          <div
            ref={containerRef}
            className="flex-1 relative min-h-[400px]"
            style={{ touchAction: "none" }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading IFC model...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                  <p className="mt-2 text-sm text-destructive">{error}</p>
                  {error.includes("WASM") || error.includes("wasm") || error.includes("initialize") ? (
                    <div className="mt-4 text-xs text-muted-foreground">
                      <p>WebAssembly 로딩에 실패했습니다.</p>
                      <p className="mt-1">브라우저 캐시를 삭제하거나 시크릿 모드에서 시도해보세요.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {!isLoaded && !isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Box className="mx-auto h-16 w-16 text-muted-foreground/30" />
                  <p className="mt-4 font-medium text-muted-foreground">
                    No IFC model loaded
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload an IFC file to view in 3D
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Side Panel */}
      <div className="w-80 flex flex-col gap-4 min-h-0">
        <Tabs defaultValue="elements" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="elements">
              <Layers className="mr-1 h-4 w-4" />
              Elements
            </TabsTrigger>
            <TabsTrigger value="properties">
              <Info className="mr-1 h-4 w-4" />
              Properties
            </TabsTrigger>
          </TabsList>

          <TabsContent value="elements" className="flex-1 mt-2 min-h-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3">
                <Input
                  placeholder="Search elements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8"
                />
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-3">
                {Object.entries(elementsByType).map(([type, typeElements]) => (
                  <div key={type}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {type} ({typeElements.length})
                    </p>
                    <div className="space-y-1">
                      {typeElements.slice(0, 20).map((element) => (
                        <ElementItem
                          key={element.expressID}
                          element={element}
                          isSelected={selectedElement?.expressID === element.expressID}
                          isVisible={visibilityMap.get(element.expressID) ?? true}
                          onSelect={() => selectElement(element.expressID)}
                          onToggleVisibility={() => toggleVisibility(element.expressID)}
                        />
                      ))}
                      {typeElements.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center py-1">
                          +{typeElements.length - 20} more
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {filteredElements.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {elements.length === 0
                      ? "No elements loaded"
                      : "No elements match search"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="properties" className="flex-1 mt-2 min-h-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  {selectedElement
                    ? selectedElement.name || selectedElement.globalId
                    : "Select an Element"}
                </CardTitle>
                {selectedElement && (
                  <Badge variant="outline" className="w-fit">
                    {selectedElement.type}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {selectedElement && selectedProperties.length > 0 ? (
                  <div className="space-y-4">
                    {/* Basic info */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">GlobalId</p>
                      <p className="font-mono text-xs">{selectedElement.globalId}</p>
                    </div>
                    {selectedElement.objectType && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">ObjectType</p>
                        <p className="text-sm">{selectedElement.objectType}</p>
                      </div>
                    )}

                    {/* Property Sets */}
                    {selectedProperties.map((pset, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-xs font-medium text-primary">{pset.name}</p>
                        <div className="space-y-1 ml-2">
                          {pset.properties.map((prop, j) => (
                            <div key={j} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{prop.name}</span>
                              <span className="font-medium truncate max-w-[50%]">
                                {String(prop.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedElement
                      ? "No properties available"
                      : "Click on an element to view its properties"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface ElementItemProps {
  element: IFCElement;
  isSelected: boolean;
  isVisible: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
}

function ElementItem({
  element,
  isSelected,
  isVisible,
  onSelect,
  onToggleVisibility,
}: ElementItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md p-2 cursor-pointer transition-colors",
        isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted"
      )}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {element.name || element.globalId.slice(0, 12) + "..."}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
      >
        {isVisible ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

export default IFCViewer;
