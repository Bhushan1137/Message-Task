import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding tenants...');

  await prisma.tenant.upsert({
    where: { id: 'tenant-a' },
    update: { name: 'Tenant A' },
    create: { id: 'tenant-a', name: 'Tenant A' },
  });

  await prisma.tenant.upsert({
    where: { id: 'tenant-b' },
    update: { name: 'Tenant B' },
    create: { id: 'tenant-b', name: 'Tenant B' },
  });

  console.log('Tenants seeded: tenant-a, tenant-b');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
