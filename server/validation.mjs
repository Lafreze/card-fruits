import { z } from "zod";

export const startRunSchema = z.object({
  mode: z.enum(["story", "endless", "expedition"]),
  level: z.number().int().min(0).max(99),
});

export const finishRunSchema = z.object({
  runId: z.string().uuid(),
  username: z
    .string()
    .trim()
    .min(1, "请输入用户名")
    .max(20, "用户名最多 20 个字符")
    .regex(/^[\p{L}\p{N}_\-· ]+$/u, "用户名含有不支持的字符"),
  score: z.number().int().min(0).max(1_000_000_000),
  maxCombo: z.number().int().min(0).max(999),
  fruitTier: z.number().int().min(0).max(20),
});

export function cleanUsername(value) {
  return value.trim().replace(/\s+/g, " ");
}
