import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    success: true,
    service: "mazetto-pos-web",
    status: "ok",
  });
}
