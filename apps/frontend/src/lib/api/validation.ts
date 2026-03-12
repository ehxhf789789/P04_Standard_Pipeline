/**
 * Validation API
 */

import apiClient from "./client";

export interface ValidationCheck {
  check_id: string;
  check_name: string;
  result: "pass" | "fail" | "warning" | "not_applicable";
  message?: string;
  details?: Record<string, any>;
}

export interface ElementValidation {
  element_id: string;
  global_id: string;
  ifc_class: string;
  name?: string;
  status: "pass" | "fail" | "warning";
  checks: ValidationCheck[];
}

export interface ValidationSummary {
  total_elements: number;
  passed: number;
  failed: number;
  warnings: number;
  pass_rate: number;
  loin_compliance: {
    overall: number;
    by_category: Record<string, number>;
  };
  bsdd_compliance: {
    overall: number;
    mapped_count: number;
    unmapped_count: number;
  };
  rules_applied: number;
}

export interface ValidationResults {
  summary: ValidationSummary;
  elements: ElementValidation[];
}

// Transform backend response to frontend format
function transformSummary(data: any): ValidationSummary {
  return {
    total_elements: data.total_elements || 0,
    passed: data.elements_passed ?? data.passed ?? 0,
    failed: data.elements_failed ?? data.failed ?? 0,
    warnings: data.elements_warning ?? data.warnings ?? 0,
    pass_rate: data.element_pass_rate ?? data.pass_rate ?? 0,
    loin_compliance: data.loin_compliance || { overall: 0, by_category: {} },
    bsdd_compliance: data.bsdd_compliance || { overall: 0, mapped_count: 0, unmapped_count: 0 },
    rules_applied: data.total_checks ?? data.rules_applied ?? 0,
  };
}

export const validationApi = {
  getSummary: async (projectId: string, runId?: string): Promise<ValidationSummary> => {
    const params = runId ? { run_id: runId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/validation/summary`, { params });
    return transformSummary(data);
  },

  getResults: async (
    projectId: string,
    options?: {
      runId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ValidationResults> => {
    const { data } = await apiClient.get(`/projects/${projectId}/validation/results`, {
      params: {
        run_id: options?.runId,
        status: options?.status,
        page: options?.page || 1,
        page_size: options?.pageSize || 50,
      },
    });
    return {
      summary: transformSummary(data.summary || {}),
      elements: data.elements || [],
    };
  },

  getElementDetails: async (
    projectId: string,
    elementId: string
  ): Promise<ElementValidation> => {
    const { data } = await apiClient.get(
      `/projects/${projectId}/validation/elements/${elementId}`
    );
    return data;
  },
};

export default validationApi;
