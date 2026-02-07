import { ok } from "@/lib/apiResponse";
import { clearClientDemoModeCookie } from "@/lib/demoMode";

export async function POST() {
  const response = ok({});
  clearClientDemoModeCookie(response);
  return response;
}
