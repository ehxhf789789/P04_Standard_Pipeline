/**
 * BIM-to-AI Pipeline TypeScript Type Definitions
 *
 * Matches backend SQLAlchemy models and API schemas
 */

// ==================== Enums ====================

export type CDEState = 'wip' | 'shared' | 'published' | 'archived';

export type DocumentType = 'ifc' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'hwpx' | 'hwp' | 'dwg' | 'rvt' | 'other';

export type PipelineStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type StageType = 'ingest' | 'parse' | 'validate' | 'enrich' | 'transform' | 'package';

export type ValidationStatus = 'pass' | 'fail' | 'warning' | 'skipped';

export type AIOutputType = 'knowledge_graph' | 'embeddings' | 'tabular' | 'gnn' | 'bcf' | 'summary' | 'report';

export type OutputFormat =
  | 'ttl' | 'rdf' | 'jsonld' | 'nt'  // KG formats
  | 'jsonl' | 'qdrant' | 'pinecone'  // Embedding formats
  | 'csv' | 'parquet' | 'xlsx'       // Tabular formats
  | 'pt' | 'dgl' | 'graphml'         // GNN formats
  | 'json' | 'zip' | 'pdf' | 'bcfzip';

export type UserRole = 'admin' | 'manager' | 'engineer' | 'viewer';

// ==================== Core Models ====================

export interface Project {
  id: string;
  name: string;
  description?: string;
  code?: string;
  clientName?: string;
  location?: string;
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  latestRunStatus?: PipelineStatus;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  code?: string;
  clientName?: string;
  location?: string;
}

export interface Document {
  id: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  documentType: DocumentType;
  cdeState: CDEState;
  publishedAt?: string;
  ifcSchema?: string;
  metadata: Record<string, unknown>;
  uploadedAt: string;
  updatedAt: string;
}

export interface DocumentUpload {
  projectId: string;
  file: File;
  cdeState?: CDEState;
}

// ==================== Pipeline ====================

export interface PipelineRun {
  id: string;
  projectId: string;
  documentId?: string;
  status: PipelineStatus;
  currentStage?: StageType;
  progressPercent: number;
  triggeredBy: string;
  configuration: PipelineConfiguration;
  elementCount: number;
  passCount: number;
  failCount: number;
  warningCount: number;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
}

export interface PipelineConfiguration {
  loinId?: string;
  idsPath?: string;
  outputFormats: AIOutputType[];
  skipValidation?: boolean;
  skipEnrichment?: boolean;
}

export interface PipelineStage {
  id: string;
  runId: string;
  stageType: StageType;
  stageOrder: number;
  status: PipelineStatus;
  progressPercent: number;
  currentStep?: string;
  totalItems: number;
  processedItems: number;
  resultSummary?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface PipelineProgress {
  runId: string;
  status: PipelineStatus;
  currentStage?: StageType;
  stageProgress: number;
  overallProgress: number;
  message?: string;
  timestamp?: string;
}

// ==================== Validation ====================

export interface ParsedElement {
  id: string;
  pipelineRunId: string;
  globalId: string;
  ifcClass: string;
  predefinedType?: string;
  name?: string;
  description?: string;
  objectType?: string;
  storeyId?: string;
  storeyName?: string;
  spaceId?: string;
  spaceName?: string;
  propertySets: Record<string, Record<string, unknown>>;
  quantities: Record<string, number>;
  materials: Material[];
  classifications: Classification[];
  boundingBox?: BoundingBox;
  centroid?: Point3D;
}

export interface Material {
  name: string;
  category?: string;
  thickness?: number;
}

export interface Classification {
  system: string;
  code: string;
  name?: string;
}

export interface BoundingBox {
  min: Point3D;
  max: Point3D;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ValidationResult {
  id: string;
  pipelineRunId: string;
  elementId: string;
  validationSource: 'ids' | 'loin' | 'bsdd' | 'custom';
  ruleId?: string;
  requirementName?: string;
  status: ValidationStatus;
  message?: string;
  facetType?: 'entity' | 'attribute' | 'property' | 'material' | 'classification' | 'partOf';
  expectedValue?: string;
  actualValue?: string;
  details?: Record<string, unknown>;
}

export interface ValidationSummary {
  totalElements: number;
  passCount: number;
  failCount: number;
  warningCount: number;
  passRate: number;
  byFacet: Record<string, FacetSummary>;
  byIfcClass: Record<string, ClassSummary>;
}

export interface FacetSummary {
  total: number;
  pass: number;
  fail: number;
  warning: number;
}

export interface ClassSummary {
  total: number;
  pass: number;
  fail: number;
  completeness: number;
}

// ==================== Enrichment ====================

export interface EnrichmentMapping {
  id: string;
  elementId: string;
  localPropertySet: string;
  localPropertyName: string;
  localValue?: string;
  bsddPropertyUri?: string;
  bsddPropertyName?: string;
  bsddClassUri?: string;
  bsddClassName?: string;
  mappingType: 'exact' | 'similar' | 'suggested' | 'manual';
  confidence: number;
  isValid?: boolean;
  validationError?: string;
}

export interface EnrichmentSummary {
  totalElements: number;
  enrichedCount: number;
  mappingRate: number;
  byMappingType: Record<string, number>;
  unmappedProperties: string[];
}

// ==================== AI Outputs ====================

export interface AIOutput {
  id: string;
  pipelineRunId: string;
  outputType: AIOutputType;
  outputFormat: OutputFormat;
  name: string;
  description?: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  metadata: OutputMetadata;
  qualityMetrics?: Record<string, unknown>;
  generatedAt: string;
}

export interface OutputMetadata {
  // Knowledge Graph
  tripleCount?: number;
  nodeCount?: number;
  edgeCount?: number;
  ontologies?: string[];

  // Embeddings
  chunkCount?: number;
  dimensions?: number;
  model?: string;

  // Tabular
  rowCount?: number;
  columnCount?: number;
  featureSet?: string;

  // GNN
  nodeTypes?: string[];
  edgeTypes?: string[];
}

// ==================== Knowledge Graph ====================

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    tripleCount: number;
    ontologies: string[];
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

// ==================== GNN Data ====================

export interface GNNData {
  nodes: GNNNode[];
  edges: GNNEdge[];
  statistics: GNNStatistics;
}

export interface GNNNode {
  id: string;
  type: string;
  features: Record<string, number>;
  label?: number;
}

export interface GNNEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface GNNStatistics {
  numNodes: number;
  numEdges: number;
  nodeTypeCounts: Record<string, number>;
  edgeTypeCounts: Record<string, number>;
  avgDegree: number;
}

// ==================== Embeddings ====================

export interface EmbeddingData {
  embeddings: EmbeddingPoint[];
  metadata: {
    model: string;
    dimensions: number;
    chunkCount: number;
  };
}

export interface EmbeddingPoint {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  // For visualization (t-SNE/UMAP reduced)
  x?: number;
  y?: number;
  z?: number;
}

// ==================== User & Auth ====================

export interface User {
  id: string;
  email?: string;
  fullName?: string;
  organization?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ==================== WebSocket Events ====================

export type WSEventType =
  | 'PIPELINE_STARTED'
  | 'STAGE_STARTED'
  | 'STAGE_PROGRESS'
  | 'STAGE_COMPLETED'
  | 'PIPELINE_COMPLETED'
  | 'PIPELINE_FAILED';

export interface WSEvent {
  type: WSEventType;
  runId: string;
  timestamp: string;
  data: WSEventData;
}

export interface WSEventData {
  stage?: StageType;
  status?: PipelineStatus;
  progress?: number;
  message?: string;
  error?: string;
  durationMs?: number;
}

// ==================== API Response Types ====================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// ==================== BCF (BIM Collaboration Format) ====================

export interface BCFTopic {
  guid: string;
  title: string;
  description?: string;
  topicType: 'Error' | 'Warning' | 'Info' | 'Request' | 'Issue' | 'Clash';
  topicStatus: 'Open' | 'InProgress' | 'Closed' | 'Resolved' | 'ReOpened';
  priority?: 'Low' | 'Normal' | 'High' | 'Critical';
  labels: string[];
  assignedTo?: string;
  dueDate?: string;
  creationDate: string;
  creationAuthor: string;
  affectedElements: string[];
  comments: BCFComment[];
  viewpoints: BCFViewpoint[];
}

export interface BCFComment {
  guid: string;
  date: string;
  author: string;
  commentText: string;
  viewpointGuid?: string;
}

export interface BCFViewpoint {
  guid: string;
  snapshotFilename?: string;
  components: BCFComponent[];
}

export interface BCFComponent {
  ifcGuid: string;
  originatingSystem?: string;
  ifcEntity?: string;
}
