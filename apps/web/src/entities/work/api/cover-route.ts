import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRaw } from "@/shared/api/index.server";

/** 브라우저는 API를 직접 부르지 않으므로 표지 이미지를 여기서 전달한다. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params;
  if (!z.uuid().safeParse(workId).success) return new NextResponse(null, { status: 404 });

  const response = await apiRaw(`/works/${workId}/cover`);
  if (!response.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      // 주소에 수정 시각이 들어가므로 오래 캐시해도 된다.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
