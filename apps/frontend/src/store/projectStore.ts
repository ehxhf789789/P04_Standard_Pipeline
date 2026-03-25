/**
 * Project Store
 *
 * Global state management for projects and pipeline runs.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  Document,
  PipelineRun,
  PipelineProgress,
  ValidationSummary,
  CDEState,
} from "@/types";

interface ProjectState {
  // Current project
  currentProject: Project | null;
  currentDocuments: Document[];
  currentPipelineRun: PipelineRun | null;
  pipelineProgress: PipelineProgress | null;

  // All projects list
  projects: Project[];
  isLoading: boolean;
  error: string | null;

  // Validation results cache
  validationSummary: ValidationSummary | null;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  setCurrentDocuments: (documents: Document[]) => void;
  setCurrentPipelineRun: (run: PipelineRun | null) => void;
  setPipelineProgress: (progress: PipelineProgress | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setValidationSummary: (summary: ValidationSummary | null) => void;

  // Document actions
  addDocument: (document: Document) => void;
  updateDocumentState: (id: string, state: CDEState) => void;
  removeDocument: (id: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentProject: null,
  currentDocuments: [],
  currentPipelineRun: null,
  pipelineProgress: null,
  projects: [],
  isLoading: false,
  error: null,
  validationSummary: null,
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentProject: (project) =>
        set({ currentProject: project, currentDocuments: [], validationSummary: null }),

      setCurrentDocuments: (documents) =>
        set({ currentDocuments: documents }),

      setCurrentPipelineRun: (run) =>
        set({ currentPipelineRun: run }),

      setPipelineProgress: (progress) =>
        set({ pipelineProgress: progress }),

      setProjects: (projects) =>
        set({ projects }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
          currentProject:
            state.currentProject?.id === id
              ? { ...state.currentProject, ...updates }
              : state.currentProject,
        })),

      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject:
            state.currentProject?.id === id ? null : state.currentProject,
        })),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error }),

      setValidationSummary: (validationSummary) =>
        set({ validationSummary }),

      addDocument: (document) =>
        set((state) => ({
          currentDocuments: [...state.currentDocuments, document],
        })),

      updateDocumentState: (id, cdeState) =>
        set((state) => ({
          currentDocuments: state.currentDocuments.map((d) =>
            d.id === id ? { ...d, cdeState } : d
          ),
        })),

      removeDocument: (id) =>
        set((state) => ({
          currentDocuments: state.currentDocuments.filter((d) => d.id !== id),
        })),

      reset: () => set(initialState),
    }),
    {
      name: "bim-pipeline-project-store",
      partialize: (state) => ({
        // Only persist current project ID, not full data
        currentProjectId: state.currentProject?.id,
      }),
    }
  )
);

// Selectors
export const selectCurrentProject = (state: ProjectState) => state.currentProject;
export const selectCurrentDocuments = (state: ProjectState) => state.currentDocuments;
export const selectPipelineProgress = (state: ProjectState) => state.pipelineProgress;
export const selectIsLoading = (state: ProjectState) => state.isLoading;
export const selectError = (state: ProjectState) => state.error;

// Document selectors
export const selectIFCDocuments = (state: ProjectState) =>
  state.currentDocuments.filter((d) => d.documentType === "ifc");

export const selectDocumentsByState = (state: ProjectState, cdeState: CDEState) =>
  state.currentDocuments.filter((d) => d.cdeState === cdeState);

export const selectPublishedDocuments = (state: ProjectState) =>
  selectDocumentsByState(state, "published");
