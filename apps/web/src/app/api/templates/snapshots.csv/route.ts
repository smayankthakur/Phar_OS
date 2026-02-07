export async function GET() {
  const csv = "sku,competitor_name,price,captured_at\nDEMO-SKU-010,DemoMart,115,2026-02-07T10:00:00Z\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"pharos-snapshots-template.csv\"",
    },
  });
}
