import Link from "next/link";
import { LoadDemoDatasetButton } from "@/components/LoadDemoDatasetButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/tenant";

export default async function RulesPage() {
  const { workspace, role } = await getCurrentWorkspace();
  const ownerMode = role === "OWNER";

  const rules = await prisma.rule.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <section className="content-card">
      <div className="page-intro">
        <div>
          <h2>Rules</h2>
          <p>IF event THEN recommend action.</p>
        </div>
        {ownerMode ? (
          <Link href="/rules/new" className="button-primary">
            New Rule
          </Link>
        ) : (
          <span className="badge" title="Insufficient permissions">
            OWNER only
          </span>
        )}
      </div>

      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>EventType</th>
            <th>Enabled</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <EmptyState
                  title="No rules yet"
                  description="Load demo defaults or create a custom rule."
                  action={
                    <>
                      <LoadDemoDatasetButton />
                      {ownerMode ? (
                        <Link href="/rules/new" className="button-primary">
                          Create rule
                        </Link>
                      ) : null}
                    </>
                  }
                />
              </td>
            </tr>
          ) : null}
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{rule.eventType}</td>
              <td>{rule.enabled ? "Yes" : "No"}</td>
              <td>
                <Link href={`/rules/${rule.id}`} className="button-secondary">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
