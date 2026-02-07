export async function GET() {
  const csv = "sku,title,cost,current_price,status\nDEMO-SKU-010,Sample Product,100,120,ACTIVE\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"pharos-skus-template.csv\"",
    },
  });
}
