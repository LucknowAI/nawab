import { NextResponse } from "next/server";
import { BACKEND } from "@/app/lib/backend";


export const dynamic = "force-dynamic";

export const GET = async () => {
  try {
    const upstream = await fetch(`${BACKEND}/api/v1/health/`, { cache: "no-store" });
    return new NextResponse(null, { status: upstream.status });
  } catch (err) {
    console.error("[health] backend unreachable:", err);
    return new NextResponse(null, { status: 502 });
  }
};
