const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.$queryRawUnsafe('select 1');
    console.log('db-ok');
  } catch (e) {
    console.error('db-err', e.message);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
})();
