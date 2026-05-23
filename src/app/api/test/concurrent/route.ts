import { NextResponse } from 'next/server';
import { createLeadAndAllocate } from '@/services/lead';
import { ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// POST /api/test/concurrent
//
// Generates 10 concurrent leads to stress-test the allocation
// engine's transaction handling and concurrency safety.
// ============================================================

export async function POST() {
  try {
    // Get available services
    const { default: prisma } = await import('@/lib/prisma');
    const services = await prisma.service.findMany();

    if (services.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No services found. Run seed first.' },
        { status: 400 }
      );
    }

    // Generate 10 concurrent leads with unique phone numbers
    const leadPromises = Array.from({ length: 10 }, (_, i) => {
      const service = services[i % services.length];
      const uniquePhone = `90000${String(Date.now()).slice(-5)}${String(i).padStart(2, '0')}`;

      return createLeadAndAllocate({
        name: `Test User ${uuidv4().slice(0, 8)}`,
        phone: uniquePhone,
        city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'][i % 5],
        serviceId: service.id,
        description: `Concurrent test lead #${i + 1}`,
      })
        .then((result) => ({ status: 'fulfilled' as const, leadIndex: i + 1, result }))
        .catch((error: Error) => ({ status: 'rejected' as const, leadIndex: i + 1, error: error.message }));
    });

    // Execute ALL 10 simultaneously
    const results = await Promise.all(leadPromises);

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    const response: ApiResponse = {
      success: true,
      data: {
        message: `Concurrent test complete: ${succeeded} succeeded, ${failed} failed`,
        total: 10,
        succeeded,
        failed,
        results,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Concurrent test failed';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
