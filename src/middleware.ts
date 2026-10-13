import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const PUBLIC = ["/login", "/setup", "/sin-base-de-datos", "/api/cron"];

// Solo redirige a /login si no hay cookie de sesión. La firma se verifica en el servidor
// (requireUser / getCurrentUser) en cada página y acción, que es lo que protege los datos.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo-bocubi).*)"],
};
