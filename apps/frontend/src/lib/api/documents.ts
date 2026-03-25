/**
 * Documents API Client
 *
 * Handles document upload, CDE state management, and document operations.
 */

import { apiClient, API_URL } from "./client";
import type {
  Document,
  DocumentUpload,
  CDEState,
  PaginatedResponse,
  ListFilters,
} from "@/types";

export interface DocumentFilters extends ListFilters {
  documentType?: string;
  cdeState?: CDEState;
}

/**
 * Upload a document to a project
 */
export async function uploadDocument(
  projectId: string,
  file: File,
  cdeState: CDEState = "wip"
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("cde_state", cdeState);

  const response = await apiClient.post<Document>(
    `/projects/${projectId}/documents`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}

/**
 * Get all documents for a project
 */
export async function getProjectDocuments(
  projectId: string,
  filters?: DocumentFilters
): Promise<PaginatedResponse<Document>> {
  const response = await apiClient.get<PaginatedResponse<Document>>(
    `/projects/${projectId}/documents`,
    { params: filters }
  );

  return response.data;
}

/**
 * Get a single document
 */
export async function getDocument(documentId: string): Promise<Document> {
  const response = await apiClient.get<Document>(`/documents/${documentId}`);
  return response.data;
}

/**
 * Update document CDE state (ISO 19650 workflow)
 */
export async function updateDocumentState(
  documentId: string,
  newState: CDEState
): Promise<Document> {
  const response = await apiClient.patch<Document>(
    `/documents/${documentId}/state`,
    { cde_state: newState }
  );

  return response.data;
}

/**
 * Publish a document (triggers pipeline automatically)
 */
export async function publishDocument(documentId: string): Promise<Document> {
  return updateDocumentState(documentId, "published");
}

/**
 * Archive a document
 */
export async function archiveDocument(documentId: string): Promise<Document> {
  return updateDocumentState(documentId, "archived");
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/documents/${documentId}`);
}

/**
 * Get document download URL
 */
export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_URL}/api/v1/documents/${documentId}/download`;
}

/**
 * Get document versions
 */
export async function getDocumentVersions(
  documentId: string
): Promise<DocumentVersion[]> {
  const response = await apiClient.get<DocumentVersion[]>(
    `/documents/${documentId}/versions`
  );
  return response.data;
}

/**
 * Upload a new version of a document
 */
export async function uploadDocumentVersion(
  documentId: string,
  file: File,
  changeDescription?: string
): Promise<DocumentVersion> {
  const formData = new FormData();
  formData.append("file", file);
  if (changeDescription) {
    formData.append("change_description", changeDescription);
  }

  const response = await apiClient.post<DocumentVersion>(
    `/documents/${documentId}/versions`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}

// Types
interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileSize: number;
  fileHash: string;
  changeDescription?: string;
  changedBy?: string;
  createdAt: string;
}

// CDE State transitions
export const CDE_STATE_TRANSITIONS: Record<CDEState, CDEState[]> = {
  wip: ["shared"],
  shared: ["wip", "published"],
  published: ["archived"],
  archived: [],
};

/**
 * Check if a state transition is valid
 */
export function canTransitionTo(
  currentState: CDEState,
  targetState: CDEState
): boolean {
  return CDE_STATE_TRANSITIONS[currentState].includes(targetState);
}

/**
 * Get human-readable CDE state label
 */
export function getCDEStateLabel(state: CDEState): string {
  const labels: Record<CDEState, string> = {
    wip: "Work In Progress",
    shared: "Shared",
    published: "Published",
    archived: "Archived",
  };
  return labels[state];
}

/**
 * Get CDE state color for UI
 */
export function getCDEStateColor(state: CDEState): string {
  const colors: Record<CDEState, string> = {
    wip: "bg-yellow-100 text-yellow-800",
    shared: "bg-blue-100 text-blue-800",
    published: "bg-green-100 text-green-800",
    archived: "bg-gray-100 text-gray-800",
  };
  return colors[state];
}
