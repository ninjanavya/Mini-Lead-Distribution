import prisma from '@/lib/prisma';
import { CreateLeadInput, AllocationResult } from '@/types';
import { allocateProviders } from './allocation';

// ============================================================
// LEAD SERVICE
//
// Handles lead creation with duplicate detection and
// triggers the allocation engine after successful creation.
// ============================================================

/**
 * Creates a new lead and allocates providers.
 * 
 * The duplicate check (phone + serviceId) is enforced at the
 * database level via UNIQUE constraint. We catch the Prisma
 * unique constraint violation error (P2002) and return a
 * friendly error message.
 */
export async function createLeadAndAllocate(
  input: CreateLeadInput
): Promise<AllocationResult> {
  // Validate required fields
  if (!input.name?.trim()) throw new Error('Name is required');
  if (!input.phone?.trim()) throw new Error('Phone number is required');
  if (!input.city?.trim()) throw new Error('City is required');
  if (!input.serviceId?.trim()) throw new Error('Service type is required');

  // Sanitize phone number (digits only)
  const sanitizedPhone = input.phone.replace(/\D/g, '');
  if (sanitizedPhone.length < 10) {
    throw new Error('Phone number must be at least 10 digits');
  }

  try {
    // Create the lead — DB constraint handles duplicate detection
    const lead = await prisma.lead.create({
      data: {
        name: input.name.trim(),
        phone: sanitizedPhone,
        city: input.city.trim(),
        serviceId: input.serviceId,
        description: input.description?.trim() || null,
      },
    });

    // Allocate providers (runs in its own transaction with locks)
    const result = await allocateProviders(lead.id, lead.serviceId);
    return result;
  } catch (error: unknown) {
    // Handle Prisma unique constraint violation
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new Error(
        'A lead with this phone number already exists for this service. ' +
        'You can submit a request for a different service.'
      );
    }
    throw error;
  }
}
