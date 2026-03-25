"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Upload,
  FileText,
  ShieldCheck,
  Tags,
  Zap,
  Database,
  ExternalLink,
} from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import type { ParsedData } from "@/lib/api/query";
import apiClient from "@/lib/api/client";

const stageIcons: Record<string, React.ElementType> = {
  Ingest: Upload,
  Parse: FileText,
  Validate: ShieldCheck,
  Enrich: Tags,
  Transform: Zap,
  "AI Lake": Database,
};

const stageColors: Record<string, string> = {
  Ingest: "bg-slate-100 text-slate-700 border-slate-200",
  Parse: "bg-blue-100 text-blue-700 border-blue-200",
  Validate: "bg-violet-100 text-violet-700 border-violet-200",
  Enrich: "bg-amber-100 text-amber-700 border-amber-200",
  Transform: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "AI Lake": "bg-indigo-100 text-indigo-700 border-indigo-200",
};

interface Props {
  data: ParsedData;
  projectId?: string;
  onDataUpdate?: (data: ParsedData) => void;
}

export function ProcessingReport({ data, projectId, onDataUpdate }: Props) {
  const { lang } = useLanguageStore();
  const L = lang === "ko";
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set([2, 3]));
  const [isFixing, setIsFixing] = useState(false);

  const pipeline = data.standards_pipeline || [];
  const validation = data.validation_summary;
  const bsddMappings = data.bsdd_mappings || [];
  const docType = (data as any).document_type;
  const ngItems = (data as any).ng_items || [];
  const ngCount = (data as any).ng_count || 0;
  const warningCount = (data as any).warning_count || 0;
  const domainRelevance = (data as any).domain_relevance;
  const allChecks = validation?.ids_checks || [];
  // Only show auto-fix for metadata-level fixes, not for content that requires re-uploading
  const fileExt = data.extension || "";
  const isEditableFormat = [".xlsx", ".xls", ".csv", ".ifc"].includes(fileExt);
  const fixableChecks = isEditableFormat
    ? allChecks.filter((c: any) => c.result === "FAIL" && c.auto_fix)
    : allChecks.filter((c: any) => c.result === "FAIL" && c.auto_fix && ["fix_title", "fix_author", "fix_date", "fix_naming", "fix_revision"].includes(c.auto_fix.id));

  const handleAutoFix = async (fixId: string) => {
    if (!projectId || !data.file_id) return;
    setIsFixing(true);
    try {
      const { data: result } = await apiClient.post(
        `/projects/${projectId}/files/${data.file_id}/auto-fix`,
        [fixId],
      );
      if (result.parsed && onDataUpdate) {
        onDataUpdate(result.parsed);
      }
    } catch (e) {
      console.error("Auto-fix failed:", e);
    } finally {
      setIsFixing(false);
    }
  };

  const handleAutoFixAll = async () => {
    if (!projectId || !data.file_id) return;
    setIsFixing(true);
    try {
      const { data: result } = await apiClient.post(
        `/projects/${projectId}/files/${data.file_id}/auto-fix`,
        [],
      );
      if (result.parsed && onDataUpdate) {
        onDataUpdate(result.parsed);
      }
    } catch (e) {
      console.error("Auto-fix all failed:", e);
    } finally {
      setIsFixing(false);
    }
  };

  const toggleStage = (idx: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (pipeline.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Document Classification */}
      {docType && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">{L ? "문서 분류:" : "Document Type:"}</span>
            <span className="text-sm font-bold">{L ? docType.label_ko : docType.label_en}</span>
            <span className="text-[10px] text-muted-foreground">
              ({L ? "신뢰도" : "confidence"}: {Math.round((docType.confidence || 0) * 100)}%)
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">{L ? "적용 표준:" : "Standards:"}</span>
            {(docType.applicable_standards || []).map((s: string) => (
              <span key={s} className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Domain Relevance */}
      {domainRelevance && (
        <div className={`rounded-lg p-2.5 flex items-center gap-2 text-xs ${
          domainRelevance.is_relevant ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
        }`}>
          <span className={`font-semibold ${domainRelevance.is_relevant ? "text-blue-700" : "text-red-700"}`}>
            {L ? "도메인:" : "Domain:"}
          </span>
          <span>{domainRelevance.domain}</span>
          <span className="text-muted-foreground">({domainRelevance.confidence}%)</span>
          {domainRelevance.matched_terms?.length > 0 && (
            <span className="text-muted-foreground ml-auto hidden md:inline">
              {domainRelevance.matched_terms.slice(0, 5).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* NG/OK Summary Banner */}
      <div className={`rounded-lg p-3 flex items-center gap-3 ${
        ngCount > 0 ? "bg-red-50 border border-red-200" : warningCount > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"
      }`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
          ngCount > 0 ? "bg-red-500" : warningCount > 0 ? "bg-amber-500" : "bg-green-500"
        }`}>
          {ngCount > 0 ? "NG" : warningCount > 0 ? "!" : "OK"}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {ngCount > 0
              ? (L ? `${ngCount}건의 부적합(NG) 항목 발견` : `${ngCount} Non-Conformance (NG) items found`)
              : warningCount > 0
              ? (L ? `${warningCount}건의 경고 항목` : `${warningCount} warning items`)
              : (L ? "모든 표준 검증 통과" : "All standards checks passed")}
          </p>
          {validation && (
            <p className="text-xs text-muted-foreground">
              IDS {L ? "적합성" : "Compliance"}: {validation.ids_compliance}% | LOIN: {validation.loin_level}
            </p>
          )}
        </div>
      </div>

      {/* NG Items Detail with Auto-Fix */}
      {(ngItems.length > 0 || fixableChecks.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-red-700">{L ? "부적합/경고 항목" : "Non-Conformance / Warning Items"}</h4>
            {fixableChecks.length > 0 && projectId && (
              <button
                onClick={handleAutoFixAll}
                disabled={isFixing}
                className="text-[10px] font-medium bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isFixing
                  ? (L ? "보정 중..." : "Fixing...")
                  : (L ? `${fixableChecks.length}건 자동 보정` : `Auto-fix ${fixableChecks.length} items`)}
              </button>
            )}
          </div>
          {allChecks.filter((c: any) => c.result === "FAIL" || c.result === "WARNING").map((check: any, i: number) => (
            <div key={i} className={`rounded-lg border p-3 ${check.result === "FAIL" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${check.result === "FAIL" ? "bg-red-500 text-white" : "bg-amber-500 text-white"}`}>
                  {check.result === "FAIL" ? "NG" : "WARN"}
                </span>
                <span className="text-[10px] font-mono text-primary">[{check.facet}]</span>
                <span className="text-xs font-medium flex-1">{check.check}</span>
                {check.auto_fix && projectId && (
                  <button
                    onClick={() => handleAutoFix(check.auto_fix.id)}
                    disabled={isFixing}
                    className="text-[10px] font-medium bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {L ? "자동 보정" : "Auto-fix"}
                  </button>
                )}
              </div>
              {check.note && <p className="text-[10px] text-muted-foreground">{check.note}</p>}
              {check.auto_fix && (
                <p className="text-[10px] text-blue-700 mt-1 bg-blue-50 rounded px-2 py-1">
                  💡 {L ? check.auto_fix.desc_ko : check.auto_fix.desc_en}
                  {check.auto_fix.value && <span className="font-mono ml-1">→ {String(check.auto_fix.value).substring(0, 60)}</span>}
                </p>
              )}
            </div>
          ))}
          {/* Fixed items */}
          {allChecks.filter((c: any) => c.result === "FIXED").map((check: any, i: number) => (
            <div key={`fixed-${i}`} className="rounded-lg border border-green-200 bg-green-50/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white">FIXED</span>
                <span className="text-[10px] font-mono text-primary">[{check.facet}]</span>
                <span className="text-xs font-medium">{check.check}</span>
              </div>
              {check.note && <p className="text-[10px] text-green-700 mt-0.5">{check.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">
          {L ? "표준 파이프라인 상세" : "Standards Pipeline Detail"}
        </h3>
      </div>

      {/* Pipeline stages */}
      <div className="space-y-2">
        {pipeline.map((step: any, idx: number) => {
          const Icon = stageIcons[step.stage] || FileText;
          const colors = stageColors[step.stage] || "bg-gray-100 text-gray-700 border-gray-200";
          const isExpanded = expandedStages.has(idx);
          const isPass = step.status === "completed";

          return (
            <div key={idx} className="rounded-lg border overflow-hidden">
              {/* Stage header - clickable */}
              <button
                onClick={() => toggleStage(idx)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
              >
                {/* Stage badge */}
                <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border ${colors} flex-shrink-0`}>
                  <Icon className="h-3 w-3" />
                  {step.stage}
                </div>

                {/* Standard code */}
                <span className="text-[10px] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded flex-shrink-0">
                  {step.standard}
                </span>

                {/* Action summary */}
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {step.action}
                </span>

                {/* Status */}
                {isPass ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                )}

                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t bg-muted/10">
                  {/* Standard info */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-[10px] font-semibold text-muted-foreground w-16">{L ? "표준:" : "Standard:"}</span>
                    <span className="text-xs font-mono">{step.standard}</span>
                    <span className="text-[10px] text-muted-foreground">— {step.standard_name}</span>
                  </div>

                  {/* Details */}
                  <div className="text-xs text-muted-foreground bg-background rounded-md p-2.5">
                    {step.details}
                  </div>

                  {/* Input/Output */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-background rounded-md p-2">
                      <span className="font-semibold text-muted-foreground">{L ? "입력:" : "Input:"}</span>
                      <p className="mt-0.5">{step.input}</p>
                    </div>
                    <div className="bg-background rounded-md p-2">
                      <span className="font-semibold text-muted-foreground">{L ? "출력:" : "Output:"}</span>
                      <p className="mt-0.5">{step.output}</p>
                    </div>
                  </div>

                  {/* IDS checks detail */}
                  {step.checks && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground">{L ? "검증 항목:" : "Validation Checks:"}</p>
                      {step.checks.map((check: any, ci: number) => (
                        <div key={ci} className="flex items-center gap-2 text-[10px] bg-background rounded px-2 py-1">
                          {check.result === "PASS" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-mono text-muted-foreground w-20">[{check.facet}]</span>
                          <span className="flex-1">{check.check}</span>
                          <span className={`font-semibold ${check.result === "PASS" ? "text-emerald-600" : "text-amber-600"}`}>
                            {check.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* bSDD mappings detail */}
                  {step.mappings && step.mappings.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground">{L ? "bSDD 매핑:" : "bSDD Mappings:"}</p>
                      <div className="flex flex-wrap gap-1">
                        {step.mappings.map((m: any, mi: number) => (
                          <span key={mi} className="inline-flex items-center gap-1 text-[10px] bg-background rounded px-2 py-0.5 border">
                            <span className="text-muted-foreground">{m.keyword}</span>
                            <span className="text-primary">→</span>
                            <span className="font-mono font-medium">{m.bsdd_class}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
