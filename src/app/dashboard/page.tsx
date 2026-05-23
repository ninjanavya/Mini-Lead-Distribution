'use client';

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { usePolling } from '@/hooks/usePolling';
import { DashboardData } from '@/types';

export default function DashboardPage() {
  const fetcher = useCallback(async (): Promise<DashboardData> => {
    const res = await fetch('/api/dashboard');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }, []);

  const { data, error, isLoading } = usePolling<DashboardData>(fetcher, 3000);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="text-sm text-gray-500">Auto-refreshes every 3 seconds</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.totalLeads}</p>
            <p className="text-xs text-gray-500">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.totalAssignments}</p>
            <p className="text-xs text-gray-500">Assignments</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Provider cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{provider.name}</CardTitle>
                <Badge
                  variant={provider.remainingQuota > 3 ? 'default' : provider.remainingQuota > 0 ? 'secondary' : 'destructive'}
                >
                  {provider.remainingQuota} left
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Quota</span>
                  <span className="font-medium">{provider.usedQuota} / {provider.monthlyQuota}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Leads</span>
                  <span className="font-medium">{provider.leadsReceived}</span>
                </div>
                {/* Quota bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      provider.usedQuota >= provider.monthlyQuota
                        ? 'bg-red-500'
                        : provider.usedQuota > provider.monthlyQuota * 0.7
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (provider.usedQuota / provider.monthlyQuota) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Detailed assignments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Lead Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.providers.flatMap((provider) =>
                provider.assignedLeads.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>{assignment.lead.name}</TableCell>
                    <TableCell className="font-mono text-sm">{assignment.lead.phone}</TableCell>
                    <TableCell>{assignment.lead.city}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.lead.service.name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(assignment.lead.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {data.totalAssignments === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No leads assigned yet. Submit a service request to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Last updated timestamp */}
      <p className="text-xs text-gray-400 text-right">
        Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
      </p>
    </div>
  );
}
