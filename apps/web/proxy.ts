import { parsePublicEnvironment } from "@cluvvi/config";
import type { Database } from "@cluvvi/database";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOCAL_BROWSER_PATHS = [
  "/",
  "/runs",
  "/settings/local",
  "/operations/discovery",
  "/api/health",
  "/api/capabilities",
  "/api/runs",
];

function isLocalBrowserPath(pathname: string): boolean {
  return LOCAL_BROWSER_PATHS.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}

export async function proxy(request: NextRequest) {
  if (
    process.env["CLUVVI_ENGINE_MODE"] === "fixture" &&
    isLocalBrowserPath(request.nextUrl.pathname)
  ) {
    return NextResponse.next({ request });
  }

  const environment = parsePublicEnvironment(process.env);
  let response = NextResponse.next({ request });
  const client = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await client.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
