import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/** contracts의 zod 스키마로 입력을 검증한다. 필드별 메시지는 화면의 오류 안내에 그대로 쓴다. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    throw new BadRequestException({
      statusCode: 400,
      message: Object.values(fieldErrors)[0] ?? "입력값을 확인해 주세요.",
      fieldErrors,
    });
  }
}
