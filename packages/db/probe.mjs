import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  await p.$queryRawUnsafe('select 1');
  console.log('db-ok');
} catch (e) {
  console.error('db-err', e?.message || e);
  process.exit(1);
} finally {
  await p.$disconnect();
}
