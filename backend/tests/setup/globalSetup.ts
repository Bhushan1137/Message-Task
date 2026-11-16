import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/messaging_platform_test?schema=public';

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DB_URL;

  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  try {
    await prisma.$connect();
    // Reset and migrate test database
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('Global setup failed:', err);
    throw err;
  }

  // Run prisma migrate deploy on test database
  const { execSync } = require('child_process');
  execSync(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  // Seed test tenants
  const p2 = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  await p2.$connect();
  await p2.tenant.upsert({
    where: { id: 'tenant-a' },
    update: { name: 'Tenant A' },
    create: { id: 'tenant-a', name: 'Tenant A' },
  });
  await p2.tenant.upsert({
    where: { id: 'tenant-b' },
    update: { name: 'Tenant B' },
    create: { id: 'tenant-b', name: 'Tenant B' },
  });
  await p2.$disconnect();
}
