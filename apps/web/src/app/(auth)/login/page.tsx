import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSetupRequired } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const setupRequired = await isSetupRequired();
  if (setupRequired) {
    redirect("/setup");
  }
  const params = await searchParams;

  return (
    <main className="main-area">
      <section className="content-card" style={{ maxWidth: 480, margin: "4rem auto" }}>
        <h1>PharOS Login</h1>
        <p>Sign in with your workspace account.</p>
        <LoginForm nextPath={params.next} />
      </section>
    </main>
  );
}
