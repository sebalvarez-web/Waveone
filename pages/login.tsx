import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.push("/");
  };

  return (
    <>
      <Head>
        <title>Wave One — Iniciar sesión</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-headline-md font-headline text-primary">
              Wave One
            </h1>
            <p className="text-body-md text-outline mt-1">
              Panel de Administración
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-xl p-8 space-y-5"
          >
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">
                CORREO ELECTRÓNICO
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="admin@equipo.com"
              />
            </div>

            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">
                CONTRASEÑA
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-error text-body-md text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg font-headline-sm text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
