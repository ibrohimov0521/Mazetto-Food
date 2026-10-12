import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolveServerProtocol,
  toServerMiddlewareRewrite,
} from "./lib/relative-middleware-rewrite.mjs";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/api/v1" ||
    request.nextUrl.pathname.startsWith("/api/v1/")
  ) {
    const headers = new Headers(request.headers);
    const host = request.headers.get("host");
    if (host) headers.set("x-forwarded-host", host);
    else headers.delete("x-forwarded-host");

    return NextResponse.next({ request: { headers } });
  }

  const response = intlMiddleware(request);
  const rewriteUrl = toServerMiddlewareRewrite(
    response.headers.get("x-middleware-rewrite"),
    {
      hostname:
        process.env.NODE_ENV === "production"
          ? process.env.HOSTNAME || "0.0.0.0"
          : "localhost",
      port: process.env.PORT || "3000",
      protocol: resolveServerProtocol(
        request.headers.get("x-forwarded-proto"),
        request.nextUrl.protocol,
      ),
    },
  );
  if (rewriteUrl) {
    response.headers.set("x-middleware-rewrite", rewriteUrl);
  }
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*", "/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
