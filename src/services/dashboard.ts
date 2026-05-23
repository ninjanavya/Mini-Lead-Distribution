import prisma from '@/lib/prisma';
import { DashboardData } from '@/types';

// ============================================================
// DASHBOARD SERVICE
//
// Provides real-time dashboard data from the database.
// All data is fetched fresh on each request (no caching)
// to ensure the dashboard reflects current state.
// ============================================================

/**
 * Fetches complete dashboard data including all providers,
 * their quotas, and assigned leads.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [providers, totalLeads, totalAssignments] = await Promise.all([
    // Fetch all providers with their assigned leads
    prisma.provider.findMany({
      orderBy: { name: 'asc' },
      include: {
        assignments: {
          include: {
            lead: {
              include: {
                service: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    // Count total leads
    prisma.lead.count(),
    // Count total assignments
    prisma.leadAssignment.count(),
  ]);

  return {
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      monthlyQuota: p.monthlyQuota,
      usedQuota: p.usedQuota,
      remainingQuota: p.monthlyQuota - p.usedQuota,
      leadsReceived: p.assignments.length,
      assignedLeads: p.assignments.map((a) => ({
        id: a.id,
        leadId: a.leadId,
        lead: {
          id: a.lead.id,
          name: a.lead.name,
          phone: a.lead.phone,
          city: a.lead.city,
          service: {
            name: a.lead.service.name,
          },
          createdAt: a.lead.createdAt.toISOString(),
        },
      })),
    })),
    totalLeads,
    totalAssignments,
    lastUpdated: new Date().toISOString(),
  };
}
