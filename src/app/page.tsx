import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Lead Distribution System</h1>
        <p className="text-gray-500">
          Production-grade lead allocation with concurrency safety,
          persistent round-robin fairness, and webhook idempotency.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Request Service</CardTitle>
            <CardDescription>
              Submit a service enquiry. Your lead will be automatically
              distributed to 3 providers using fair allocation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/request-service">
              <Button className="w-full">Submit Lead Request</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider Dashboard</CardTitle>
            <CardDescription>
              Monitor provider assignments, quotas, and lead distribution
              in real time with auto-refresh every 3 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">View Dashboard</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Tools</CardTitle>
            <CardDescription>
              Stress-test the system with concurrent lead generation,
              webhook simulation, and quota reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/test-tools">
              <Button variant="outline" className="w-full">Open Test Tools</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
