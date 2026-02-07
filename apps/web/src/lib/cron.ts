import { err } from "@/lib/apiResponse";

export function requireCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return err("INTERNAL", "CRON_SECRET is not configured", 500);
  }

  const provided = request.headers.get("x-pharos-cron");
  if (!provided || provided !== expected) {
    // 401 to avoid leaking more detail than needed.
    return err("UNAUTHORIZED", "Invalid cron secret", 401);
  }

  return null;
}

