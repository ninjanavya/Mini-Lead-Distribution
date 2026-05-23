import { NextRequest, NextResponse } from 'next/server';
import { createLeadAndAllocate } from '@/services/lead';
import { CreateLeadInput, ApiResponse, AllocationResult } from '@/types';

// ============================================================
// POST /api/leads
//
// Creates a new lead and allocates providers.
// Returns allocation result with assigned providers.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateLeadInput = await request.json();

    const result = await createLeadAndAllocate(body);

    const response: ApiResponse<AllocationResult> = {
      success: true,
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Determine appropriate status code
    const isDuplicate = message.includes('already exists');
    const isQuotaExhausted = message.includes('exhausted') || message.includes('Not enough');
    const isValidation = message.includes('required') || message.includes('must be');
    
    const status = isDuplicate ? 409 : isQuotaExhausted ? 422 : isValidation ? 400 : 500;

    const response: ApiResponse = {
      success: false,
      error: message,
    };

    return NextResponse.json(response, { status });
  }
}
