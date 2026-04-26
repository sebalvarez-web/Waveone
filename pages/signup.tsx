import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <>
      <Head><title>Wave One — Crear cuenta</title></Head>
      <div className="min-h-screen flex">
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

            {success ? (
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-[28px] fill">check_circle</span>
                </div>
                <h2 className="text-headline-lg font-headline text-on-background">Cuenta creada</h2>
                <p className="text-body-md text-on-surface-variant">
                  Revisa tu correo para confirmar tu cuenta. Si no lo encuentras, mira la carpeta de spam.
                </p>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary-fixed transition-all flex items-center justify-center gap-2 shadow-soft"
                >
                  Ir a iniciar sesión <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-headline-lg font-headline text-on-background">Crear cuenta</h2>
                <p className="text-body-md text-on-surface-variant mt-1.5 mb-8">
                  Empieza a gestionar tu equipo en minutos.
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
                    <label htmlFor="password" className="block text-xs font-semibold text-on-surface mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-outline-variant rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-outline hover:text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmar" className="block text-xs font-semibold text-on-surface mb-1.5">
                      Confirmar contraseña
                    </label>
                    <input
                      id="confirmar"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      className="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all"
                      placeholder="Repite la contraseña"
                    />
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
                        Creando cuenta...
                      </>
                    ) : (
                      <>Crear cuenta <span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
                    )}
                  </button>

                  <p className="text-center text-sm text-on-surface-variant pt-2">
                    ¿Ya tienes cuenta?{" "}
                    <Link href="/login" className="text-accent font-semibold hover:underline">
                      Iniciar sesión
                    </Link>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center">
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
              <span className="material-symbols-outlined text-accent text-[14px]">bolt</span>
              <span className="text-xs font-semibold tracking-wide">Comienza en minutos</span>
            </div>
            <h2 className="text-display-md font-headline leading-tight tracking-tight">
              Únete a coaches que ya <span className="text-accent">cobran sin fricción</span>.
            </h2>
            <p className="text-white/70 mt-5 text-base leading-relaxed">
              Setup rápido. Pagos automáticos vía Stripe y PayPal. Tu equipo, organizado desde el día uno.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
