import { z } from "zod";

// The demo's only configuration boundary (core/code-standards.mdc).
const envSchema = z.object({
  ELEARNING_DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
  // Optional: where the demo is served, for the lesson links inside PDF and Word exports.
  DEMO_PUBLIC_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
});

export type DemoEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): DemoEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid demo configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}
