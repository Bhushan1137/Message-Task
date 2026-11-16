import { PrismaClient } from '@prisma/client';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/messaging_platform_test?schema=public';

process.env.DATABASE_URL = TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

export async function cleanDb() {
  await prisma.webhookEvent.deleteMany();
  await prisma.message.deleteMany();
}

export async function createTestMessage(overrides: Partial<{
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
}> = {}) {
  return prisma.message.create({
    data: {
      tenantId: overrides.tenantId ?? 'tenant-a',
      conversationId: overrides.conversationId ?? 'conv-test',
      to: overrides.to ?? '+919876543210',
      text: overrides.text ?? 'Test message',
      status: 'QUEUED',
    },
  });
}

export { prisma };
