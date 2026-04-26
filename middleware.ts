import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  const publicPaths = ["/login", "/signup"];
  const isPublicPage = publicPaths.includes(req.nextUrl.pathname);

  if (!session && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && isPublicPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Protect /coaches/[id]: entrenador can only view their own profile
  const coachDetailMatch = req.nextUrl.pathname.match(/^\/coaches\/([^/]+)$/);
  if (session && coachDetailMatch) {
    const requestedId = coachDetailMatch[1];
    const userId = session.user.id;

    const { data: userRow } = await supabase
      .from("users")
      .select("rol")
      .eq("id", userId)
      .single();

    if (userRow?.rol === "entrenador" && requestedId !== userId) {
      return NextResponse.redirect(new URL(`/coaches/${userId}`, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
