import { NextRequest, NextResponse } from 'next/server';
import { processWebhook } from '@/services/webhook';
import { WebhookPayload, ApiResponse } from '@/types';

// ============================================================
// POST /api/webhooks/reset-quota
//
// Idempotent webhook endpoint for quota reset.
// Duplicate events (same eventId) are safely ignored.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json();

    const result = await processWebhook(payload);

    if (result.duplicate) {
      const response: ApiResponse = {
        success: true,
        data: { message: 'Event already processed (idempotent skip)', eventId: payload.eventId },
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse = {
      success: true,
      data: { message: 'Webhook processed successfully', eventId: payload.eventId },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    
    const response: ApiResponse = {
      success: false,
      error: message,
    };

    return NextResponse.json(response, { status: 500 });
  }
}
