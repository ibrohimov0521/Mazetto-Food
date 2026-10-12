import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const host = request.headers.get("host");
  if (host) headers.set("x-forwarded-host", host);
  else headers.delete("x-forwarded-host");

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/v1/:path*",
};
