'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface GoogleAccountStatus {
  connected: boolean;
  display_name?: string;
  email?: string;
}

export default function GoogleAccountPage() {
  const [status, setStatus] = useState<GoogleAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/google-auth/status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch Google account status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/google-auth/authorize');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account?')) {
      return;
    }

    try {
      setActionLoading(true);
      await fetch('/api/google-auth/disconnect', { method: 'POST' });
      await fetchStatus();
    } catch (error) {
      console.error('Failed to disconnect Google account:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Google Account Settings</h1>

      <Card title="Google Account Connection" className="space-y-4">
        <div className="p-6 space-y-4">
          <p className="text-sm text-white/70">
            Connect your Google account to participate in Sync Meetings and enable automatic meeting transcription.
          </p>
          {status?.connected ? (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Connected</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {status.display_name}
                </p>
                {status.email && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Email:</strong> {status.email}
                  </p>
                )}
              </div>
              <Button
                variant="danger"
                onClick={handleDisconnect}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect Google Account'
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Not Connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Google account to enable meeting participation and transcript analysis.
              </p>
              <Button onClick={handleConnect} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Google Account'
                )}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
