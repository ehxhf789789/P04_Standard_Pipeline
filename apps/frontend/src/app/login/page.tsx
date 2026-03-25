"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLanguageStore } from "@/store/languageStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const { lang, setLang } = useLanguageStore();
  const L = lang === "ko";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  useEffect(() => { clearError(); }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ email: form.email, password: form.password, name: form.name });
      }
      router.push("/");
    } catch {}
  };

  // Demo quick login
  const handleDemoLogin = async () => {
    try {
      await login({ email: "demo@bim-vortex.com", password: "demo1234" });
      router.push("/");
    } catch {
      // If demo account doesn't exist, create it
      try {
        await register({ email: "demo@bim-vortex.com", password: "demo1234", name: "Demo User" });
        router.push("/");
      } catch {}
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[480px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 text-[200px] font-black leading-none tracking-tighter">BV</div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">BIM-Vortex</h1>
              <p className="text-[10px] text-white/50 tracking-widest uppercase">AI Standards Pipeline</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-tight mb-4">
            {L ? "건설 데이터를\n국제 표준으로\nAI-Ready하게" : "Transform\nConstruction Data\nAI-Ready"}
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            {L
              ? "ISO 19650, IFC, IDS, LOIN, bSDD 등 18종 국제 표준에 기반하여 건설 전생애주기 문서를 검증하고, AI 학습/추론용 데이터로 변환합니다."
              : "Validate construction lifecycle documents based on 18 international standards (ISO 19650, IFC, IDS, LOIN, bSDD) and transform into AI-ready data."}
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap gap-2">
            {["ISO 19650", "IFC 4.3", "IDS 1.0", "LOIN", "bSDD", "BCF 3.0"].map((s) => (
              <span key={s} className="text-[9px] font-mono text-white/30 bg-white/5 rounded px-2 py-0.5">{s}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-amber-400">KICT</span>
              <span className="text-[7px] text-white/40">{L ? "한국건설기술연구원" : "Korea Institute of Civil Engineering"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black">BIM-Vortex</span>
          </div>

          {/* Title */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">
              {mode === "login" ? (L ? "로그인" : "Sign In") : (L ? "계정 생성" : "Create Account")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? (L ? "BIM-Vortex에 로그인하세요" : "Sign in to BIM-Vortex")
                : (L ? "새 계정을 만드세요" : "Create your BIM-Vortex account")}
            </p>
          </div>

          {/* Demo Login */}
          <button
            onClick={handleDemoLogin}
            className="w-full rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 py-3 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            {L ? "🚀 데모 계정으로 바로 시작" : "🚀 Quick Start with Demo Account"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground">{L ? "또는" : "or"}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600">{error}</div>
            )}

            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">{L ? "이름" : "Name"}</Label>
                <Input
                  id="name" type="text" placeholder={L ? "이름" : "Your name"}
                  value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required disabled={isLoading} className="h-10"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">{L ? "이메일" : "Email"}</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required disabled={isLoading} className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">{L ? "비밀번호" : "Password"}</Label>
              <div className="relative">
                <Input
                  id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required disabled={isLoading} className="h-10 pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-10 bg-slate-900 hover:bg-slate-800" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? (L ? "로그인" : "Sign In") : (L ? "계정 생성" : "Create Account")}
            </Button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>{L ? "계정이 없으신가요?" : "Don't have an account?"}{" "}
                <button onClick={() => setMode("register")} className="text-amber-600 font-medium hover:underline">
                  {L ? "회원가입" : "Sign Up"}
                </button>
              </>
            ) : (
              <>{L ? "이미 계정이 있으신가요?" : "Already have an account?"}{" "}
                <button onClick={() => setMode("login")} className="text-amber-600 font-medium hover:underline">
                  {L ? "로그인" : "Sign In"}
                </button>
              </>
            )}
          </p>

          {/* Language toggle */}
          <div className="flex justify-center">
            <button onClick={() => setLang(lang === "ko" ? "en" : "ko")} className="text-[10px] text-muted-foreground hover:text-foreground">
              {lang === "ko" ? "English" : "한국어"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
