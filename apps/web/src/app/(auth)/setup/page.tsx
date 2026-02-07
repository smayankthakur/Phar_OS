import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/SetupForm";
import { isSetupRequired } from "@/lib/auth";

export default async function SetupPage() {
  const setupRequired = await isSetupRequired();
  if (!setupRequired) {
    redirect("/login");
  }

  return (
    <main className="main-area">
      <section className="content-card" style={{ maxWidth: 520, margin: "4rem auto" }}>
        <h1>Initial Setup</h1>
        <p>Create the first OWNER account and workspace.</p>
        <SetupForm />
      </section>
    </main>
  );
}
