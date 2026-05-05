import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";

const ACCENT = "#C8FF00";
const INK    = "#0B1220";

const LOGO_B64 = "data:image/png;base64,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";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Correo o contraseña incorrectos."); setLoading(false); return; }
    router.push("/");
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all";

  return (
    <>
      <Head><title>Wave One — Iniciar sesión</title></Head>
      <div className="min-h-screen flex" style={{ background: INK }}>

        {/* Left — form */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12">
          <div className="w-full max-w-sm">

            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-3 mb-12">
              <div className="flex-shrink-0" style={{ width: 46, height: 27 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Wave One" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              </div>
              <div className="leading-none">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[18px] font-extrabold text-white tracking-tight leading-none">WAVE</span>
                  <span className="text-[18px] font-extrabold leading-none" style={{ color: ACCENT }}>ONE</span>
                </div>
                <p className="text-[9px] font-bold tracking-[0.18em] mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>DASHBOARD</p>
              </div>
            </Link>

            <h2 className="text-2xl font-bold text-white tracking-tight">Bienvenido de vuelta</h2>
            <p className="text-sm text-white/50 mt-1.5 mb-8">Inicia sesión para gestionar tu equipo.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5 tracking-wide">CORREO ELECTRÓNICO</label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: ACCENT } as React.CSSProperties}
                  onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}20`; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-white/60 tracking-wide">CONTRASEÑA</label>
                  <button type="button" className="text-xs font-semibold hover:underline" style={{ color: ACCENT }}>
                    ¿Olvidaste?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass + " pr-11"}
                    onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}20`; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span className="material-symbols-outlined text-red-400 text-[16px]">error</span>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                style={{ background: ACCENT, color: INK }}
              >
                {loading ? (
                  <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Iniciando...</>
                ) : (
                  <>Iniciar sesión<span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                )}
              </button>

              <p className="text-center text-sm text-white/40 pt-2">
                ¿No tienes cuenta?{" "}
                <Link href="/signup" className="font-semibold hover:underline" style={{ color: ACCENT }}>Crear cuenta</Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right — brand panel */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
          style={{ background: "linear-gradient(135deg, #111827 0%, #0d1f0d 100%)" }}>
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(rgba(200,255,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,0,1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          {/* Glow blobs */}
          <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: `${ACCENT}15` }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: `${ACCENT}08` }} />

          <div className="relative z-10 max-w-md px-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACCENT }} />
              <span className="text-xs font-semibold tracking-wide" style={{ color: ACCENT }}>Plataforma para coaches</span>
            </div>

            <h2 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Lleva el control de{" "}
              <span style={{ color: ACCENT }}>cada corredor</span>{" "}
              y cada pago.
            </h2>
            <p className="text-white/50 mt-5 text-base leading-relaxed">
              Wave One unifica corredores, pagos automáticos de Stripe y PayPal, gastos del equipo y deudas en un solo dashboard.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-10 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { value: "Auto", label: "Pagos" },
                { value: "100%", label: "Tiempo real" },
                { value: "Ágil", label: "Plataforma" },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-bold tracking-tight" style={{ color: ACCENT }}>{s.value}</p>
                  <p className="text-xs text-white/40 font-medium tracking-wider uppercase mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
