import prisma from '@/lib/prisma';
import { WebhookPayload } from '@/types';

// ============================================================
// WEBHOOK SERVICE
//
// Handles idempotent webhook processing.
// Each webhook event is identified by a unique eventId.
// If the same eventId is received again, it is ignored.
// ============================================================

/**
 * Processes a webhook event idempotently.
 * 
 * Uses the webhook_events table to track processed events.
 * If eventId already exists, the webhook is a duplicate and
 * we skip processing (return false).
 * 
 * For "payment_success" type: resets all provider quotas to 0.
 */
export async function processWebhook(
  payload: WebhookPayload
): Promise<{ processed: boolean; duplicate: boolean }> {
  if (!payload.eventId?.trim()) {
    throw new Error('eventId is required in webhook payload');
  }
  if (!payload.type?.trim()) {
    throw new Error('type is required in webhook payload');
  }

  // Check if this event has already been processed (idempotency check)
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId: payload.eventId },
  });

  if (existingEvent) {
    // Duplicate event — skip processing
    return { processed: false, duplicate: true };
  }

  // Process the webhook based on type
  if (payload.type === 'payment_success') {
    // Use a transaction to ensure atomicity:
    // 1. Record the event
    // 2. Reset all provider quotas
    await prisma.$transaction([
      // Record this event to prevent reprocessing
      prisma.webhookEvent.create({
        data: {
          eventId: payload.eventId,
          type: payload.type,
          processed: true,
        },
      }),
      // Reset all provider quotas
      prisma.provider.updateMany({
        data: { usedQuota: 0 },
      }),
    ]);

    return { processed: true, duplicate: false };
  }

  // For unknown webhook types, just record the event
  await prisma.webhookEvent.create({
    data: {
      eventId: payload.eventId,
      type: payload.type,
      processed: true,
    },
  });

  return { processed: true, duplicate: false };
}
