import { SkuForm } from "@/components/forms/SkuForm";

export default function NewSkuPage() {
  return (
    <section className="content-card">
      <h2>Add SKU</h2>
      <p>Create a SKU in the current workspace.</p>
      <SkuForm
        mode="create"
        submitLabel="Create SKU"
        successHref="/skus"
        initialValues={{
          title: "",
          sku: "",
          cost: 100,
          currentPrice: 120,
          status: "ACTIVE",
        }}
      />
    </section>
  );
}
