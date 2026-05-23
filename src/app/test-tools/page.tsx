'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid';

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  message: string;
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const addLog = (action: string, status: LogEntry['status'], message: string) => {
    setLogs((prev) => [
      {
        id: uuidv4(),
        timestamp: new Date().toLocaleTimeString(),
        action,
        status,
        message,
      },
      ...prev,
    ]);
  };

  // ── Reset Provider Quotas ─────────────────────────────────
  const handleResetQuota = async () => {
    setLoading('reset');
    const eventId = `evt_reset_${Date.now()}`;
    addLog('Reset Quota', 'pending', `Sending webhook with eventId: ${eventId}`);

    try {
      const res = await fetch('/api/webhooks/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, type: 'payment_success' }),
      });
      const data = await res.json();
      addLog('Reset Quota', data.success ? 'success' : 'error', JSON.stringify(data.data || data.error));
    } catch (err: unknown) {
      addLog('Reset Quota', 'error', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  };

  // ── Trigger Duplicate Webhook (Idempotency Test) ──────────
  const handleDuplicateWebhook = async () => {
    setLoading('webhook');
    const eventId = `evt_idempotency_test_fixed`;
    addLog('Webhook Idempotency', 'pending', `Sending SAME eventId 3 times: ${eventId}`);

    try {
      for (let i = 1; i <= 3; i++) {
        const res = await fetch('/api/webhooks/reset-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, type: 'payment_success' }),
        });
        const data = await res.json();
        const isDuplicate = data.data?.message?.includes('idempotent');
        addLog(
          `Webhook #${i}`,
          data.success ? 'success' : 'error',
          isDuplicate ? `SKIPPED (duplicate detected)` : `PROCESSED: ${JSON.stringify(data.data)}`
        );
      }
    } catch (err: unknown) {
      addLog('Webhook Idempotency', 'error', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  };

  // ── Generate 10 Concurrent Leads ──────────────────────────
  const handleConcurrentLeads = async () => {
    setLoading('concurrent');
    addLog('Concurrent Test', 'pending', 'Generating 10 concurrent leads via Promise.all...');

    try {
      const res = await fetch('/api/test/concurrent', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        addLog(
          'Concurrent Test',
          'success',
          `Completed: ${data.data.succeeded} succeeded, ${data.data.failed} failed out of ${data.data.total}`
        );
        // Log individual results
        if (data.data.results) {
          data.data.results.forEach((r: { status: string; leadIndex: number; error?: string; result?: { assignedProviders: { name: string }[] } }) => {
            if (r.status === 'rejected') {
              addLog(`Lead #${r.leadIndex}`, 'error', r.error || 'Unknown error');
            } else {
              const providers = r.result?.assignedProviders?.map((p: { name: string }) => p.name).join(', ');
              addLog(`Lead #${r.leadIndex}`, 'success', `Assigned to: ${providers}`);
            }
          });
        }
      } else {
        addLog('Concurrent Test', 'error', data.error || 'Test failed');
      }
    } catch (err: unknown) {
      addLog('Concurrent Test', 'error', err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Tools</h1>
        <p className="text-sm text-gray-500">
          Stress-test the allocation engine, webhook idempotency, and concurrent safety.
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reset Quotas</CardTitle>
            <CardDescription>
              Sends a webhook to reset all provider used_quota to 0.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleResetQuota}
              disabled={loading !== null}
              className="w-full"
              variant="outline"
            >
              {loading === 'reset' ? 'Resetting...' : 'Reset Provider Quota'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook Idempotency</CardTitle>
            <CardDescription>
              Sends the same eventId 3 times. Only the first should process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleDuplicateWebhook}
              disabled={loading !== null}
              className="w-full"
              variant="outline"
            >
              {loading === 'webhook' ? 'Testing...' : 'Trigger Duplicate Webhook'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Concurrent Leads</CardTitle>
            <CardDescription>
              Generates 10 leads simultaneously via Promise.all to stress-test transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleConcurrentLeads}
              disabled={loading !== null}
              className="w-full"
            >
              {loading === 'concurrent' ? 'Generating...' : 'Generate 10 Concurrent Leads'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Activity log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Activity Log</CardTitle>
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
                className="text-gray-400"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No activity yet. Use the buttons above to test the system.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded text-sm font-mono border ${
                    log.status === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : log.status === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <span className="text-gray-400 mr-2">[{log.timestamp}]</span>
                  <span className="font-semibold mr-2">{log.action}:</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
