import { eventTypeSchema } from "@pharos/core";
import { z } from "zod";
import { toEventDTO } from "@/lib/events";
import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { createEventAndRecommendations, RuleRunnerError } from "@/lib/ruleRunner";

const ingestSchema = z.object({
  type: eventTypeSchema,
  payload: z.unknown(),
  skuId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  let payload: z.infer<typeof ingestSchema>;
  try {
    payload = ingestSchema.parse(await request.json());
  } catch {
    return err("BAD_REQUEST", "Invalid event request", 400);
  }

  try {
    const result = await createEventAndRecommendations({
      type: payload.type,
      payload: payload.payload,
      skuId: payload.skuId,
    });
    return ok(
      {
        item: toEventDTO(result.event),
        actions: result.actions.map((action) => ({
          id: action.id,
          type: action.type,
          title: action.title,
          status: action.status,
        })),
      },
      201,
    );
  } catch (error) {
    if (error instanceof RuleRunnerError) {
      if (error.status === 404) return err("NOT_FOUND", error.message, 404);
      if (error.status === 409) return err("CONFLICT", error.message, 409);
      return err("BAD_REQUEST", error.message, 400);
    }
    return err("BAD_REQUEST", error instanceof Error ? error.message : "Invalid event payload", 400);
  }
}
