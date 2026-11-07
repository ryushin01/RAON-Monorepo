import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionToken } from "@/entities/session/index.server";
import { apiRaw } from "@/shared/api/index.server";

type Params = Promise<{ episodeId: string; imageId: string }>;

/** 공개 전 원고이므로 작가의 토큰을 붙여 전달하고 공유 캐시에 남기지 않는다. */
export async function studioImageRouteGet(_: NextRequest, { params }: { params: Params }) {
  const { episodeId, imageId } = await params;
  if (!z.uuid().safeParse(episodeId).success || !z.uuid().safeParse(imageId).success) {
    return new NextResponse(null, { status: 404 });
  }
  const token = await getSessionToken();
  if (!token) return new NextResponse(null, { status: 401 });
  const response = await apiRaw(`/studio/episodes/${episodeId}/images/${imageId}`, token);
  if (!response.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
