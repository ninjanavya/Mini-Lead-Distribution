// ============================================================
// Core domain types for the Lead Distribution System
// ============================================================

export interface CreateLeadInput {
  name: string;
  phone: string;
  city: string;
  serviceId: string;
  description?: string;
}

export interface AllocationResult {
  leadId: string;
  assignedProviders: {
    id: string;
    name: string;
    isMandatory: boolean;
  }[];
}

export interface DashboardProvider {
  id: string;
  name: string;
  monthlyQuota: number;
  usedQuota: number;
  remainingQuota: number;
  leadsReceived: number;
  assignedLeads: {
    id: string;
    leadId: string;
    lead: {
      id: string;
      name: string;
      phone: string;
      city: string;
      service: {
        name: string;
      };
      createdAt: string;
    };
  }[];
}

export interface DashboardData {
  providers: DashboardProvider[];
  totalLeads: number;
  totalAssignments: number;
  lastUpdated: string;
}

export interface WebhookPayload {
  eventId: string;
  type: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
