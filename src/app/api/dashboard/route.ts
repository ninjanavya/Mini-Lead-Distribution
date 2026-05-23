import { NextResponse } from 'next/server';
import { getDashboardData } from '@/services/dashboard';
import { ApiResponse, DashboardData } from '@/types';

// ============================================================
// GET /api/dashboard
//
// Returns real-time dashboard data.
// Called by the dashboard page via polling (every 3 seconds).
// ============================================================

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDashboardData();

    const response: ApiResponse<DashboardData> = {
      success: true,
      data,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';

    const response: ApiResponse = {
      success: false,
      error: message,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
