export async function GET() {
  const csv = "name,domain,currency\nDemoMart,demomart.test,INR\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"pharos-competitors-template.csv\"",
    },
  });
}
