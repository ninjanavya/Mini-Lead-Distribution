import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ============================================================
// DATABASE SEED SCRIPT
//
// Pre-seeds the database with:
//   - 3 Services (Service 1, Service 2, Service 3)
//   - 8 Providers (Provider 1–8, monthly_quota=10)
//   - Mandatory assignment rules per service
//   - Pool rules (additional eligible providers)
//   - Round-robin state initialized for each service
// ============================================================

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Step 1: Create Services ──────────────────────────────────
  console.log('Creating services...');
  const services = await Promise.all([
    prisma.service.upsert({
      where: { name: 'Service 1' },
      update: {},
      create: { name: 'Service 1' },
    }),
    prisma.service.upsert({
      where: { name: 'Service 2' },
      update: {},
      create: { name: 'Service 2' },
    }),
    prisma.service.upsert({
      where: { name: 'Service 3' },
      update: {},
      create: { name: 'Service 3' },
    }),
  ]);
  console.log(`  ✓ Created ${services.length} services`);

  const [service1, service2, service3] = services;

  // ── Step 2: Create Providers ─────────────────────────────────
  console.log('Creating providers...');
  const providers = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      prisma.provider.upsert({
        where: { name: `Provider ${i + 1}` },
        update: { monthlyQuota: 10, usedQuota: 0 },
        create: { name: `Provider ${i + 1}`, monthlyQuota: 10, usedQuota: 0 },
      })
    )
  );
  console.log(`  ✓ Created ${providers.length} providers (quota: 10 each)`);

  const [p1, p2, p3, p4, p5, p6, p7, p8] = providers;

  // ── Step 3: Clear existing rules (for re-seeding) ───────────
  console.log('Clearing existing rules...');
  await prisma.mandatoryRule.deleteMany();
  await prisma.poolRule.deleteMany();
  await prisma.roundRobinState.deleteMany();

  // ── Step 4: Create Mandatory Rules ──────────────────────────
  // Service 1: Provider 1 is MANDATORY
  // Service 2: Provider 5 is MANDATORY
  // Service 3: Provider 1 and Provider 4 are MANDATORY
  console.log('Creating mandatory rules...');
  await prisma.mandatoryRule.createMany({
    data: [
      { serviceId: service1.id, providerId: p1.id },  // Service 1 → Provider 1
      { serviceId: service2.id, providerId: p5.id },  // Service 2 → Provider 5
      { serviceId: service3.id, providerId: p1.id },  // Service 3 → Provider 1
      { serviceId: service3.id, providerId: p4.id },  // Service 3 → Provider 4
    ],
  });
  console.log('  ✓ Mandatory rules configured');
  console.log('    Service 1 → Provider 1 (always)');
  console.log('    Service 2 → Provider 5 (always)');
  console.log('    Service 3 → Provider 1 + Provider 4 (always)');

  // ── Step 5: Create Pool Rules ───────────────────────────────
  // Service 1 pool: Provider 2, 3, 4
  // Service 2 pool: Provider 6, 7, 8
  // Service 3 pool: Provider 2, 3, 5, 6, 7, 8
  console.log('Creating pool rules...');
  await prisma.poolRule.createMany({
    data: [
      // Service 1 additional pool
      { serviceId: service1.id, providerId: p2.id },
      { serviceId: service1.id, providerId: p3.id },
      { serviceId: service1.id, providerId: p4.id },
      // Service 2 additional pool
      { serviceId: service2.id, providerId: p6.id },
      { serviceId: service2.id, providerId: p7.id },
      { serviceId: service2.id, providerId: p8.id },
      // Service 3 additional pool
      { serviceId: service3.id, providerId: p2.id },
      { serviceId: service3.id, providerId: p3.id },
      { serviceId: service3.id, providerId: p5.id },
      { serviceId: service3.id, providerId: p6.id },
      { serviceId: service3.id, providerId: p7.id },
      { serviceId: service3.id, providerId: p8.id },
    ],
  });
  console.log('  ✓ Pool rules configured');
  console.log('    Service 1 pool → [P2, P3, P4]');
  console.log('    Service 2 pool → [P6, P7, P8]');
  console.log('    Service 3 pool → [P2, P3, P5, P6, P7, P8]');

  // ── Step 6: Initialize Round-Robin State ────────────────────
  // Each service gets a persistent round-robin counter starting at 0
  console.log('Initializing round-robin state...');
  await Promise.all(
    services.map((service) =>
      prisma.roundRobinState.create({
        data: {
          serviceId: service.id,
          lastIndex: 0,
        },
      })
    )
  );
  console.log('  ✓ Round-robin state initialized (all services start at index 0)');

  console.log('\n✅ Database seeded successfully!\n');

  // ── Summary ─────────────────────────────────────────────────
  console.log('='.repeat(50));
  console.log('SEED SUMMARY');
  console.log('='.repeat(50));
  console.log(`Services:  ${services.length}`);
  console.log(`Providers: ${providers.length} (monthly quota: 10 each)`);
  console.log('');
  console.log('Allocation Rules (3 providers per lead):');
  console.log('  Service 1: P1(mandatory) + 2 from [P2, P3, P4]');
  console.log('  Service 2: P5(mandatory) + 2 from [P6, P7, P8]');
  console.log('  Service 3: P1+P4(mandatory) + 1 from [P2,P3,P5,P6,P7,P8]');
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
