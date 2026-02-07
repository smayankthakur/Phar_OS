import { err, ok } from "@/lib/apiResponse";
import { CsrfError, verifyCsrf } from "@/lib/csrf";
import { clearClientDemoModeCookie } from "@/lib/demoMode";

export async function POST(request: Request) {
  try {
    await verifyCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return err("CSRF_INVALID", error.message, 403);
  }

  const response = ok({});
  clearClientDemoModeCookie(response);
  return response;
}
