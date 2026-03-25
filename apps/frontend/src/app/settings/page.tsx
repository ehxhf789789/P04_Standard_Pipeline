"use client";

import { useState } from "react";
import { Globe, Moon, Sun, Server, Database, HardDrive, Info, Power, FolderOpen, AlertTriangle } from "lucide-react";
import { useLanguageStore } from "@/store/languageStore";
import { useAuthStore } from "@/store/authStore";
import { API_URL } from "@/lib/api/client";
import apiClient from "@/lib/api/client";

export default function SettingsPage() {
  const { lang, setLang } = useLanguageStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const L = lang === "ko";
  const [isDark, setIsDark] = useState(false);
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);

  const handleShutdown = async () => {
    try {
      await fetch(`${API_URL}/admin/shutdown`, { method: "POST" });
      alert(L ? "서버가 종료됩니다. 브라우저를 닫아주세요." : "Server is shutting down. Please close your browser.");
    } catch {
      alert(L ? "서버 종료 요청 완료" : "Server shutdown requested");
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{L ? "설정" : "Settings"}</h1>
        <p className="text-sm text-muted-foreground">{L ? "플랫폼 환경 설정" : "Platform configuration"}</p>
      </div>

      {/* Language */}
      <Section title={L ? "언어" : "Language"} icon={Globe}>
        <div className="flex gap-2">
          {(["ko", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-4 py-2 text-sm font-medium border ${lang === l ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
              {l === "ko" ? "한국어" : "English"}
            </button>
          ))}
        </div>
      </Section>

      {/* Theme */}
      <Section title={L ? "테마" : "Theme"} icon={isDark ? Moon : Sun}>
        <div className="flex gap-2">
          <button onClick={() => { setIsDark(false); document.documentElement.classList.remove("dark"); }} className={`rounded-lg px-4 py-2 text-sm font-medium border ${!isDark ? "bg-slate-900 text-white" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
            {L ? "라이트" : "Light"}
          </button>
          <button onClick={() => { setIsDark(true); document.documentElement.classList.add("dark"); }} className={`rounded-lg px-4 py-2 text-sm font-medium border ${isDark ? "bg-slate-900 text-white" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
            {L ? "다크" : "Dark"}
          </button>
        </div>
      </Section>

      {/* Account */}
      <Section title={L ? "계정" : "Account"} icon={Info}>
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="space-y-1.5 text-sm">
              <Row label={L ? "이름" : "Name"} value={user?.name || "-"} />
              <Row label={L ? "이메일" : "Email"} value={user?.email || "-"} />
            </div>
            <button onClick={handleLogout} className="text-xs text-red-600 hover:underline">
              {L ? "로그아웃" : "Sign Out"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{L ? "로그인되지 않음" : "Not logged in"}</p>
        )}
      </Section>

      {/* Storage Structure */}
      <Section title={L ? "데이터 저장 구조" : "Data Storage Structure"} icon={FolderOpen}>
        <div className="bg-slate-900 text-slate-300 rounded-lg p-4 font-mono text-xs space-y-0.5">
          <p className="text-slate-500"># BIM-Vortex {L ? "로컬 저장 구조" : "Local Storage Structure"}</p>
          <p className="text-amber-400">uploads/</p>
          <p className="pl-4">├── <span className="text-blue-400">{"{project_id}"}/</span></p>
          <p className="pl-8">├── <span className="text-green-400">{"{file_id}.pdf"}</span>  <span className="text-slate-500"># {L ? "원본 파일" : "Original files"}</span></p>
          <p className="pl-8">├── <span className="text-green-400">{"{file_id}_parsed.json"}</span>  <span className="text-slate-500"># {L ? "파싱 결과 (AI Lake 데이터)" : "Parsed results (AI Lake data)"}</span></p>
          <p className="pl-8">└── ...</p>
          <p className="pl-4">├── <span className="text-slate-500">_projects_metadata.json</span>  <span className="text-slate-500"># {L ? "프로젝트 목록" : "Project index"}</span></p>
          <p className="pl-4">└── <span className="text-slate-500">_files_metadata.json</span>  <span className="text-slate-500"># {L ? "파일 메타데이터" : "File metadata"}</span></p>
          <p className="text-amber-400 mt-2">data/</p>
          <p className="pl-4">├── sample.ifc  <span className="text-slate-500"># {L ? "샘플 데이터" : "Sample data"}</span></p>
          <p className="pl-4">└── loin_requirements.json</p>
          <p className="text-amber-400 mt-2">outputs/</p>
          <p className="pl-4">└── <span className="text-blue-400">{"{project_id}"}/</span>  <span className="text-slate-500"># {L ? "파이프라인 출력물" : "Pipeline outputs"}</span></p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {L
            ? "원본 파일과 파싱된 AI Lake 데이터가 프로젝트 폴더 내에 함께 저장됩니다. 파싱 결과(_parsed.json)가 AI Data Lake의 검색 대상입니다."
            : "Original files and parsed AI Lake data are stored together in project folders. Parsed results (_parsed.json) are the searchable AI Data Lake."}
        </p>
      </Section>

      {/* Server */}
      <Section title={L ? "서버" : "Server"} icon={Server}>
        <div className="space-y-3">
          <div className="space-y-1.5 text-sm">
            <Row label="Backend" value={API_URL} />
            <Row label="Frontend" value={typeof window !== "undefined" ? window.location.origin : "-"} />
            <Row label={L ? "데이터베이스" : "Database"} value="SQLite" />
            <Row label={L ? "버전" : "Version"} value="1.0.0-beta" />
          </div>

          {/* Shutdown */}
          {!showShutdownConfirm ? (
            <button
              onClick={() => setShowShutdownConfirm(true)}
              className="flex items-center gap-2 text-xs text-red-600 hover:text-red-700 mt-2"
            >
              <Power className="h-3.5 w-3.5" />
              {L ? "서버 종료" : "Shutdown Server"}
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">{L ? "서버를 종료하시겠습니까?" : "Shutdown the server?"}</span>
              </div>
              <p className="text-[10px] text-red-600">
                {L
                  ? "백엔드 서버가 종료됩니다. 다시 시작하려면 start.bat을 실행하세요."
                  : "The backend server will stop. Run start.bat to restart."}
              </p>
              <div className="flex gap-2">
                <button onClick={handleShutdown} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700">
                  {L ? "종료" : "Shutdown"}
                </button>
                <button onClick={() => setShowShutdownConfirm(false)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
                  {L ? "취소" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* About */}
      <Section title={L ? "정보" : "About"} icon={Database}>
        <div className="space-y-1.5 text-sm">
          <Row label={L ? "플랫폼" : "Platform"} value="BIM-Vortex" />
          <Row label={L ? "기관" : "Organization"} value="KICT" />
          <Row label={L ? "적용 표준" : "Standards"} value={L ? "21개 국제 표준" : "21 international standards"} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs font-mono">{value}</span>
    </div>
  );
}
