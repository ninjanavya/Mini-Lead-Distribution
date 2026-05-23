import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiResponse } from '@/types';

// ============================================================
// GET /api/services
//
// Returns all available services for the lead form dropdown.
// ============================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { name: 'asc' },
    });

    const response: ApiResponse = {
      success: true,
      data: services,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
