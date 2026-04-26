import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";

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

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <>
      <Head><title>Wave One — Iniciar sesión</title></Head>
      <div className="min-h-screen flex">
        {/* Left — form */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12 bg-background">
          <div className="w-full max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-10 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-soft">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12c2-2 3.5-2 5 0s3 2 5 0 3.5-2 5 0 3 2 5 0" />
                  <path d="M2 17c2-2 3.5-2 5 0s3 2 5 0 3.5-2 5 0 3 2 5 0" opacity="0.6" />
                </svg>
              </div>
              <div>
                <h1 className="text-[18px] font-headline font-bold text-primary leading-none">Wave One</h1>
                <p className="text-[10px] text-outline font-semibold tracking-wider mt-1">ADMIN</p>
              </div>
            </Link>

            <h2 className="text-headline-lg font-headline text-on-background">Bienvenido de vuelta</h2>
            <p className="text-body-md text-on-surface-variant mt-1.5 mb-8">
              Inicia sesión para gestionar tu equipo.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-on-surface mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
                  placeholder="tu@correo.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-on-surface">
                    Contraseña
                  </label>
                  <button type="button" className="text-xs text-accent font-semibold hover:underline">
                    ¿Olvidaste?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-outline-variant rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-outline hover:text-on-surface transition-colors"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-error-container/50 border border-error/20 rounded-lg" role="alert">
                  <span className="material-symbols-outlined text-error text-[18px] mt-0.5">error</span>
                  <p className="text-sm text-on-error-container">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-fixed active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-soft"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Iniciando...
                  </>
                ) : (
                  <>Iniciar sesión <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                )}
              </button>

              <p className="text-center text-sm text-on-surface-variant pt-2">
                ¿No tienes cuenta?{" "}
                <Link href="/signup" className="text-accent font-semibold hover:underline">
                  Crear cuenta
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right — brand panel */}
        <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center">
          {/* Decorative waves */}
          <div className="absolute inset-0 opacity-[0.07]">
            <svg viewBox="0 0 600 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
              {Array.from({ length: 8 }).map((_, i) => (
                <path
                  key={i}
                  d={`M0 ${100 + i * 60} Q150 ${60 + i * 60} 300 ${100 + i * 60} T600 ${100 + i * 60}`}
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                />
              ))}
            </svg>
          </div>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative z-10 max-w-md px-12 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-semibold tracking-wide">Plataforma para coaches</span>
            </div>
            <h2 className="text-display-md font-headline leading-tight tracking-tight">
              Lleva el control de <span className="text-accent">cada corredor</span> y cada pago.
            </h2>
            <p className="text-white/70 mt-5 text-base leading-relaxed">
              Wave One unifica corredores, pagos automáticos de Stripe y PayPal, gastos del equipo y deudas en un solo dashboard.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-white/10">
              <Stat label="Pagos" value="auto" />
              <Stat label="Tiempo real" value="100%" />
              <Stat label="Plataforma" value="ágil" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-headline font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-white/50 font-medium tracking-wider uppercase mt-1">{label}</p>
    </div>
  );
}
