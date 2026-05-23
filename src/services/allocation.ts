import prisma from '@/lib/prisma';
import { AllocationResult } from '@/types';

// ============================================================
// ALLOCATION ENGINE
// 
// This is the core of the lead distribution system.
// All allocation logic runs inside a single PostgreSQL
// transaction with row-level locking to ensure:
//   - No quota overflow under concurrent requests
//   - No duplicate assignments
//   - Fair round-robin distribution (persistent state)
//   - Complete atomicity (all-or-nothing)
// ============================================================

const PROVIDERS_PER_LEAD = 3;

/**
 * Allocates exactly 3 providers to a lead within a single
 * serializable transaction using row-level locks.
 * 
 * Steps:
 * 1. Lock and fetch mandatory providers (SELECT FOR UPDATE)
 * 2. Validate mandatory providers have quota
 * 3. Lock and fetch round-robin state (SELECT FOR UPDATE)
 * 4. Lock and fetch pool providers (SELECT FOR UPDATE)
 * 5. Round-robin select additional providers from pool
 * 6. Create lead assignments
 * 7. Increment used_quota for all assigned providers
 * 8. Update round-robin state index
 */
export async function allocateProviders(
  leadId: string,
  serviceId: string
): Promise<AllocationResult> {
  return await prisma.$transaction(async (tx) => {
    // ── Step 1: Lock mandatory providers for this service ────────
    // Using raw SQL for SELECT ... FOR UPDATE (Prisma doesn't support this natively)
    const mandatoryProviders = await tx.$queryRaw<
      Array<{ id: string; name: string; monthly_quota: number; used_quota: number }>
    >`
      SELECT p.id, p.name, p.monthly_quota, p.used_quota
      FROM providers p
      INNER JOIN mandatory_rules mr ON mr.provider_id = p.id
      WHERE mr.service_id = ${serviceId}
      ORDER BY p.id
      FOR UPDATE OF p
    `;

    // ── Step 2: Validate all mandatory providers have remaining quota ──
    for (const provider of mandatoryProviders) {
      if (provider.used_quota >= provider.monthly_quota) {
        throw new Error(
          `Mandatory provider "${provider.name}" has exhausted monthly quota ` +
          `(${provider.used_quota}/${provider.monthly_quota}). Cannot allocate lead.`
        );
      }
    }

    // Calculate how many additional providers we need from the pool
    const additionalNeeded = PROVIDERS_PER_LEAD - mandatoryProviders.length;

    if (additionalNeeded < 0) {
      throw new Error(
        `Service has ${mandatoryProviders.length} mandatory providers but only ` +
        `${PROVIDERS_PER_LEAD} slots available. Configuration error.`
      );
    }

    const mandatoryIds = mandatoryProviders.map((p) => p.id);
    let selectedPoolProviders: Array<{ id: string; name: string }> = [];
    let newRoundRobinIndex = 0;

    if (additionalNeeded > 0) {
      // ── Step 3: Lock round-robin state for this service ──────────
      const rrState = await tx.$queryRaw<
        Array<{ id: string; last_index: number }>
      >`
        SELECT id, last_index
        FROM round_robin_state
        WHERE service_id = ${serviceId}
        FOR UPDATE
      `;

      if (rrState.length === 0) {
        throw new Error(`No round-robin state found for service ${serviceId}`);
      }

      const currentIndex = rrState[0].last_index;

      // ── Step 4: Lock eligible pool providers (with quota remaining) ──
      // Exclude mandatory providers from the pool to avoid duplicates
      const poolProviders = await tx.$queryRaw<
        Array<{ id: string; name: string; used_quota: number; monthly_quota: number }>
      >`
        SELECT p.id, p.name, p.used_quota, p.monthly_quota
        FROM providers p
        INNER JOIN pool_rules pr ON pr.provider_id = p.id
        WHERE pr.service_id = ${serviceId}
          AND p.used_quota < p.monthly_quota
          AND p.id NOT IN (SELECT unnest(${mandatoryIds}::text[]))
        ORDER BY p.name
        FOR UPDATE OF p
      `;

      if (poolProviders.length < additionalNeeded) {
        throw new Error(
          `Not enough eligible pool providers. Need ${additionalNeeded} ` +
          `but only ${poolProviders.length} have remaining quota.`
        );
      }

      // ── Step 5: Round-robin selection from pool ────────────────
      // The round-robin index wraps around the pool size.
      // We pick `additionalNeeded` providers starting from currentIndex.
      selectedPoolProviders = [];
      let idx = currentIndex % poolProviders.length;

      for (let i = 0; i < additionalNeeded; i++) {
        selectedPoolProviders.push({
          id: poolProviders[idx].id,
          name: poolProviders[idx].name,
        });
        idx = (idx + 1) % poolProviders.length;
      }

      newRoundRobinIndex = idx;

      // ── Step 8: Update round-robin state ──────────────────────
      await tx.$executeRaw`
        UPDATE round_robin_state
        SET last_index = ${newRoundRobinIndex}, updated_at = NOW()
        WHERE service_id = ${serviceId}
      `;
    }

    // ── Step 6: Create lead assignments for all providers ────────
    const allProviders = [
      ...mandatoryProviders.map((p) => ({ id: p.id, name: p.name, isMandatory: true })),
      ...selectedPoolProviders.map((p) => ({ ...p, isMandatory: false })),
    ];

    for (const provider of allProviders) {
      // Create the assignment
      await tx.$executeRaw`
        INSERT INTO lead_assignments (id, lead_id, provider_id, created_at)
        VALUES (gen_random_uuid()::text, ${leadId}, ${provider.id}, NOW())
      `;

      // ── Step 7: Atomically increment the provider's used quota ──
      await tx.$executeRaw`
        UPDATE providers
        SET used_quota = used_quota + 1
        WHERE id = ${provider.id}
      `;
    }

    return {
      leadId,
      assignedProviders: allProviders,
    };
  }, {
    // Transaction configuration for concurrency safety
    isolationLevel: 'Serializable',
    timeout: 15000, // 15 second timeout for safety
  });
}
