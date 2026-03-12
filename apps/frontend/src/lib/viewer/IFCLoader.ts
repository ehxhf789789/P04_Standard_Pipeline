/**
 * IFC Loader Utility
 * Loads and processes IFC files using web-ifc
 * Uses dynamic import to avoid SSR issues with WebAssembly
 */

export interface IFCElement {
  expressID: number;
  globalId: string;
  type: string;
  name?: string;
  description?: string;
  objectType?: string;
}

export interface IFCProperty {
  name: string;
  value: string | number | boolean;
}

export interface IFCPropertySet {
  name: string;
  properties: IFCProperty[];
}

// Store WebIFC module reference and shared initialized API
let WebIFC: typeof import("web-ifc") | null = null;
let sharedIfcAPI: import("web-ifc").IfcAPI | null = null;
let initPromise: Promise<void> | null = null;

// Pre-fetch WASM to ensure it's available
async function prefetchWasm(): Promise<ArrayBuffer | null> {
  const wasmUrls = [
    "/wasm/web-ifc.wasm",
    "https://cdn.jsdelivr.net/npm/web-ifc@0.0.54/web-ifc.wasm",
    "https://unpkg.com/web-ifc@0.0.54/web-ifc.wasm",
  ];

  for (const url of wasmUrls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log("WASM prefetched from:", url);
        return buffer;
      }
    } catch (e) {
      console.warn("Failed to fetch WASM from:", url, e);
    }
  }
  return null;
}

export interface IFCMeshData {
  expressID: number;
  vertices: Float32Array;
  indices: Uint32Array;
  color: { r: number; g: number; b: number; a: number };
  flatTransformation: number[];
}

export class IFCLoader {
  private ifcAPI: import("web-ifc").IfcAPI | null = null;
  private modelID: number = -1;
  private meshCache: Map<number, IFCMeshData> = new Map();

  async init(): Promise<void> {
    // Already initialized for this instance
    if (this.ifcAPI) return;

    // If shared API exists, use it
    if (sharedIfcAPI) {
      this.ifcAPI = sharedIfcAPI;
      return;
    }

    // Ensure we only initialize once globally
    if (initPromise) {
      await initPromise;
      // After waiting, sharedIfcAPI should be set
      if (sharedIfcAPI) {
        this.ifcAPI = sharedIfcAPI;
      }
      return;
    }

    initPromise = this._doInit();
    await initPromise;
  }

  private async _doInit(): Promise<void> {
    // Dynamically import web-ifc to ensure it runs only on client
    if (!WebIFC) {
      WebIFC = await import("web-ifc");
    }

    const api = new WebIFC.IfcAPI();

    // WASM paths to try (in order of preference)
    const wasmBases = [
      "/wasm/",
      "https://cdn.jsdelivr.net/npm/web-ifc@0.0.54/",
      "https://unpkg.com/web-ifc@0.0.54/",
    ];

    let lastError: Error | null = null;

    for (const base of wasmBases) {
      try {
        console.log("Trying WASM base:", base);

        // Use custom locateFile handler
        const locateFile = (path: string, prefix: string) => {
          console.log("locateFile called:", { path, prefix, base });
          return base + path;
        };

        await api.Init(locateFile);
        console.log("web-ifc initialized successfully with base:", base);

        // Store globally and locally
        sharedIfcAPI = api;
        this.ifcAPI = api;
        return;
      } catch (e) {
        console.warn("Failed to init with base:", base, e);
        lastError = e as Error;
      }
    }

    // If all paths failed, throw a user-friendly error
    throw new Error(
      `IFC 뷰어 초기화에 실패했습니다: ${lastError?.message || "Unknown error"}`
    );
  }

  async loadFile(file: File | ArrayBuffer): Promise<number> {
    if (!this.ifcAPI) {
      await this.init();
    }

    // Double-check initialization succeeded
    if (!this.ifcAPI) {
      throw new Error("IFC API가 초기화되지 않았습니다. 페이지를 새로고침해 주세요.");
    }

    let data: Uint8Array;
    if (file instanceof File) {
      const buffer = await file.arrayBuffer();
      data = new Uint8Array(buffer);
    } else {
      data = new Uint8Array(file);
    }

    // Clear previous mesh cache
    this.meshCache.clear();

    // Open model with settings
    this.modelID = this.ifcAPI!.OpenModel(data, {
      COORDINATE_TO_ORIGIN: true,
    });

    // Stream all meshes and cache them
    this.ifcAPI!.StreamAllMeshes(this.modelID, (mesh) => {
      const expressID = mesh.expressID;
      const geometries = mesh.geometries;

      for (let i = 0; i < geometries.size(); i++) {
        const placedGeom = geometries.get(i);
        const geomData = this.ifcAPI!.GetGeometry(this.modelID, placedGeom.geometryExpressID);

        const vertices = this.ifcAPI!.GetVertexArray(
          geomData.GetVertexData(),
          geomData.GetVertexDataSize()
        );
        const indices = this.ifcAPI!.GetIndexArray(
          geomData.GetIndexData(),
          geomData.GetIndexDataSize()
        );

        const color = placedGeom.color;
        const transform = placedGeom.flatTransformation;

        this.meshCache.set(expressID, {
          expressID,
          vertices: new Float32Array(vertices),
          indices: new Uint32Array(indices),
          color: { r: color.x, g: color.y, b: color.z, a: color.w },
          flatTransformation: Array.from(transform),
        });

        geomData.delete();
      }
    });

    console.log(`Loaded ${this.meshCache.size} meshes from IFC file`);
    return this.modelID;
  }

  async loadFromUrl(url: string): Promise<number> {
    // Pre-initialize before fetching
    if (!this.ifcAPI) {
      await this.init();
    }

    console.log("Fetching IFC file from:", url);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `IFC 파일을 불러오는데 실패했습니다: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
      );
    }

    const buffer = await response.arrayBuffer();
    console.log(`Downloaded IFC file: ${buffer.byteLength} bytes`);
    return this.loadFile(buffer);
  }

  getAllElements(): IFCElement[] {
    if (!this.ifcAPI || this.modelID < 0 || !WebIFC) return [];

    const elements: IFCElement[] = [];

    // Get all spatial structure elements
    const spatialTypes = [
      WebIFC.IFCSITE,
      WebIFC.IFCBUILDING,
      WebIFC.IFCBUILDINGSTOREY,
      WebIFC.IFCSPACE,
    ];

    // Get all building elements
    const buildingTypes = [
      WebIFC.IFCWALL,
      WebIFC.IFCWALLSTANDARDCASE,
      WebIFC.IFCSLAB,
      WebIFC.IFCBEAM,
      WebIFC.IFCCOLUMN,
      WebIFC.IFCDOOR,
      WebIFC.IFCWINDOW,
      WebIFC.IFCROOF,
      WebIFC.IFCSTAIR,
      WebIFC.IFCRAMP,
      WebIFC.IFCFURNISHINGELEMENT,
      WebIFC.IFCFLOWSEGMENT,
      WebIFC.IFCFLOWTERMINAL,
      WebIFC.IFCFLOWFITTING,
    ];

    const allTypes = [...spatialTypes, ...buildingTypes];

    for (const typeID of allTypes) {
      try {
        const ids = this.ifcAPI!.GetLineIDsWithType(this.modelID, typeID);
        for (let i = 0; i < ids.size(); i++) {
          const expressID = ids.get(i);
          const props = this.ifcAPI!.GetLine(this.modelID, expressID);

          elements.push({
            expressID,
            globalId: props.GlobalId?.value || "",
            type: this.getTypeName(typeID),
            name: props.Name?.value,
            description: props.Description?.value,
            objectType: props.ObjectType?.value,
          });
        }
      } catch {
        // Type not found in model
      }
    }

    return elements;
  }

  getElementProperties(expressID: number): IFCPropertySet[] {
    if (!this.ifcAPI || this.modelID < 0 || !WebIFC) return [];

    const propertySets: IFCPropertySet[] = [];

    try {
      // Get all IfcRelDefinesByProperties relationships
      const relDefinesType = WebIFC.IFCRELDEFINESBYPROPERTIES;
      const relDefinesIds = this.ifcAPI.GetLineIDsWithType(this.modelID, relDefinesType);

      for (let i = 0; i < relDefinesIds.size(); i++) {
        const relId = relDefinesIds.get(i);
        const rel = this.ifcAPI.GetLine(this.modelID, relId);

        // Check if this relationship applies to our element
        const relatedObjects = rel.RelatedObjects;
        if (!relatedObjects) continue;

        let isRelated = false;
        for (let j = 0; j < relatedObjects.length; j++) {
          const objRef = relatedObjects[j];
          if (objRef?.value === expressID) {
            isRelated = true;
            break;
          }
        }

        if (!isRelated) continue;

        // Get the property set
        const psetRef = rel.RelatingPropertyDefinition;
        if (!psetRef?.value) continue;

        const pset = this.ifcAPI.GetLine(this.modelID, psetRef.value);
        if (!pset || !pset.HasProperties) continue;

        const properties: IFCProperty[] = [];

        for (const propRef of pset.HasProperties) {
          if (!propRef?.value) continue;
          const prop = this.ifcAPI.GetLine(this.modelID, propRef.value);

          if (prop.NominalValue) {
            properties.push({
              name: prop.Name?.value || "Unknown",
              value: prop.NominalValue?.value,
            });
          }
        }

        if (properties.length > 0) {
          propertySets.push({
            name: pset.Name?.value || "Properties",
            properties,
          });
        }
      }
    } catch (e) {
      console.error("Error getting properties:", e);
    }

    return propertySets;
  }

  getGeometry(expressID: number): IFCMeshData | null {
    return this.meshCache.get(expressID) || null;
  }

  getAllMeshes(): IFCMeshData[] {
    return Array.from(this.meshCache.values());
  }

  getCoordinationMatrix(): number[] {
    if (!this.ifcAPI || this.modelID < 0) {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }

    try {
      const matrix = this.ifcAPI.GetCoordinationMatrix(this.modelID);
      return Array.from(matrix);
    } catch {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }
  }

  private getTypeName(typeID: number): string {
    if (!WebIFC) return "IfcElement";

    const typeNames: Record<number, string> = {
      [WebIFC.IFCSITE]: "IfcSite",
      [WebIFC.IFCBUILDING]: "IfcBuilding",
      [WebIFC.IFCBUILDINGSTOREY]: "IfcBuildingStorey",
      [WebIFC.IFCSPACE]: "IfcSpace",
      [WebIFC.IFCWALL]: "IfcWall",
      [WebIFC.IFCWALLSTANDARDCASE]: "IfcWallStandardCase",
      [WebIFC.IFCSLAB]: "IfcSlab",
      [WebIFC.IFCBEAM]: "IfcBeam",
      [WebIFC.IFCCOLUMN]: "IfcColumn",
      [WebIFC.IFCDOOR]: "IfcDoor",
      [WebIFC.IFCWINDOW]: "IfcWindow",
      [WebIFC.IFCROOF]: "IfcRoof",
      [WebIFC.IFCSTAIR]: "IfcStair",
      [WebIFC.IFCRAMP]: "IfcRamp",
      [WebIFC.IFCFURNISHINGELEMENT]: "IfcFurnishingElement",
      [WebIFC.IFCFLOWSEGMENT]: "IfcFlowSegment",
      [WebIFC.IFCFLOWTERMINAL]: "IfcFlowTerminal",
      [WebIFC.IFCFLOWFITTING]: "IfcFlowFitting",
    };
    return typeNames[typeID] || "IfcElement";
  }

  dispose(): void {
    if (this.ifcAPI && this.modelID >= 0) {
      this.ifcAPI.CloseModel(this.modelID);
      this.modelID = -1;
    }
  }
}

export default IFCLoader;
