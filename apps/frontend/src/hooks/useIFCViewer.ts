"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ThreeViewer, SelectionInfo } from "@/lib/viewer/ThreeViewer";
import { IFCLoader, IFCElement, IFCPropertySet } from "@/lib/viewer/IFCLoader";

export interface UseIFCViewerOptions {
  containerRef: React.RefObject<HTMLElement>;
  onElementSelect?: (element: IFCElement | null, properties: IFCPropertySet[]) => void;
}

export interface UseIFCViewerReturn {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  elements: IFCElement[];
  selectedElement: IFCElement | null;
  loadFile: (file: File) => Promise<void>;
  loadUrl: (url: string) => Promise<void>;
  selectElement: (expressID: number) => void;
  setVisibility: (expressID: number, visible: boolean) => void;
  fitToView: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export function useIFCViewer(options: UseIFCViewerOptions): UseIFCViewerReturn {
  const { containerRef, onElementSelect } = options;

  const viewerRef = useRef<ThreeViewer | null>(null);
  const loaderRef = useRef<IFCLoader | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elements, setElements] = useState<IFCElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<IFCElement | null>(null);

  // Initialize viewer
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new ThreeViewer({
      container: containerRef.current,
      backgroundColor: 0xf0f4f8,
      enableGrid: true,
      enableAxes: true,
    });

    viewer.onElementSelect((info: SelectionInfo | null) => {
      if (info) {
        const element = elements.find((e) => e.expressID === info.expressID);
        if (element) {
          setSelectedElement(element);

          // Get properties
          if (loaderRef.current) {
            const properties = loaderRef.current.getElementProperties(info.expressID);
            onElementSelect?.(element, properties);
          }
        }
      } else {
        setSelectedElement(null);
        onElementSelect?.(null, []);
      }
    });

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [containerRef]);

  // Update selection callback when elements change
  useEffect(() => {
    if (!viewerRef.current) return;

    viewerRef.current.onElementSelect((info: SelectionInfo | null) => {
      if (info) {
        const element = elements.find((e) => e.expressID === info.expressID);
        if (element) {
          setSelectedElement(element);

          if (loaderRef.current) {
            const properties = loaderRef.current.getElementProperties(info.expressID);
            onElementSelect?.(element, properties);
          }
        }
      } else {
        setSelectedElement(null);
        onElementSelect?.(null, []);
      }
    });
  }, [elements, onElementSelect]);

  // Load IFC file
  const loadFile = useCallback(async (file: File) => {
    if (!viewerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // Initialize loader if needed
      if (!loaderRef.current) {
        loaderRef.current = new IFCLoader();
        await loaderRef.current.init();
      }

      // Load the file
      await loaderRef.current.loadFile(file);

      // Get elements for the sidebar
      const loadedElements = loaderRef.current.getAllElements();
      setElements(loadedElements);

      // Get all meshes and create 3D objects
      const meshes = loaderRef.current.getAllMeshes();
      console.log(`Adding ${meshes.length} meshes to viewer`);

      for (const mesh of meshes) {
        // Convert RGBA color to hex
        const colorHex =
          (Math.floor(mesh.color.r * 255) << 16) |
          (Math.floor(mesh.color.g * 255) << 8) |
          Math.floor(mesh.color.b * 255);

        viewerRef.current.addMesh(
          mesh.expressID,
          mesh.vertices,
          mesh.indices,
          colorHex || 0xc0c0c0,
          mesh.flatTransformation
        );
      }

      // Fit view to model
      viewerRef.current.fitToView();
      setIsLoaded(true);
    } catch (e) {
      console.error("Error loading IFC file:", e);
      setError(e instanceof Error ? e.message : "Failed to load IFC file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load IFC from URL
  const loadUrl = useCallback(async (url: string) => {
    if (!viewerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      if (!loaderRef.current) {
        loaderRef.current = new IFCLoader();
        await loaderRef.current.init();
      }

      await loaderRef.current.loadFromUrl(url);

      const loadedElements = loaderRef.current.getAllElements();
      setElements(loadedElements);

      // Get all meshes and create 3D objects
      const meshes = loaderRef.current.getAllMeshes();
      console.log(`Adding ${meshes.length} meshes to viewer (from URL)`);

      for (const mesh of meshes) {
        const colorHex =
          (Math.floor(mesh.color.r * 255) << 16) |
          (Math.floor(mesh.color.g * 255) << 8) |
          Math.floor(mesh.color.b * 255);

        viewerRef.current.addMesh(
          mesh.expressID,
          mesh.vertices,
          mesh.indices,
          colorHex || 0xc0c0c0,
          mesh.flatTransformation
        );
      }

      viewerRef.current.fitToView();
      setIsLoaded(true);
    } catch (e) {
      console.error("Error loading IFC from URL:", e);
      setError(e instanceof Error ? e.message : "Failed to load IFC file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select element
  const selectElement = useCallback((expressID: number) => {
    if (!viewerRef.current) return;

    viewerRef.current.selectElement(expressID);

    const element = elements.find((e) => e.expressID === expressID);
    if (element) {
      setSelectedElement(element);

      if (loaderRef.current) {
        const properties = loaderRef.current.getElementProperties(expressID);
        onElementSelect?.(element, properties);
      }
    }
  }, [elements, onElementSelect]);

  // Set element visibility
  const setVisibility = useCallback((expressID: number, visible: boolean) => {
    if (!viewerRef.current) return;
    viewerRef.current.setMeshVisibility(expressID, visible);
  }, []);

  // Camera controls
  const fitToView = useCallback(() => {
    viewerRef.current?.fitToView();
  }, []);

  const resetView = useCallback(() => {
    viewerRef.current?.resetView();
  }, []);

  const zoomIn = useCallback(() => {
    viewerRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    viewerRef.current?.zoomOut();
  }, []);

  // Cleanup loader on unmount
  useEffect(() => {
    return () => {
      loaderRef.current?.dispose();
      loaderRef.current = null;
    };
  }, []);

  return {
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
  };
}

// Helper function to assign colors based on IFC type
function getColorForType(type: string): number {
  const colorMap: Record<string, number> = {
    IfcWall: 0xc0c0c0,
    IfcWallStandardCase: 0xc0c0c0,
    IfcSlab: 0x808080,
    IfcBeam: 0xa0a0a0,
    IfcColumn: 0x909090,
    IfcDoor: 0x8b4513,
    IfcWindow: 0x87ceeb,
    IfcRoof: 0xb22222,
    IfcStair: 0xdaa520,
    IfcSpace: 0x90ee90,
    IfcFurnishingElement: 0xdeb887,
    IfcFlowSegment: 0x4682b4,
    IfcFlowTerminal: 0x4169e1,
  };

  return colorMap[type] || 0xc0c0c0;
}

export default useIFCViewer;
