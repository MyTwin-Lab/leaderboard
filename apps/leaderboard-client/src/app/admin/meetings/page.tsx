'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MeetingList } from '@/components/admin/MeetingList';
import { MeetingForm } from '@/components/admin/MeetingForm';
import { ParticipantsModal } from '@/components/admin/ParticipantsModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { SyncMeeting, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<SyncMeeting[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [participantsMeeting, setParticipantsMeeting] = useState<SyncMeeting | null>(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    fetchMeetings();
    fetchChallenges();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/sync-meetings');
      const data = await res.json();
      setMeetings(data.meetings ?? []);
    } catch {
      toast('Failed to load meetings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch {
      console.error('Error fetching challenges');
    }
  };

  const handleCreate = async (data: {
    title: string;
    description?: string;
    challenge_id: string;
    start_time: string;
    end_time: string;
  }) => {
    try {
      const res = await fetch('/api/sync-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await fetchMeetings();
        setShowForm(false);
        toast('Meeting created', 'success');
      } else {
        toast('Failed to create meeting', 'error');
      }
    } catch {
      toast('Failed to create meeting', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Cancel Meeting',
      message: 'This will permanently cancel this meeting. Are you sure?',
      confirmLabel: 'Cancel Meeting',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/sync-meetings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMeetings();
        toast('Meeting cancelled', 'success');
      } else {
        toast('Failed to cancel meeting', 'error');
      }
    } catch {
      toast('Failed to cancel meeting', 'error');
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="space-y-6">
        {showForm ? (
          <Card title="New Meeting">
            <MeetingForm
              challenges={challenges}
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </Card>
        ) : (
          <Card
            title="Sync Meetings"
            count={meetings.length}
            className="rounded-md"
            action={
              <Button onClick={() => setShowForm(true)}>+ New Meeting</Button>
            }
          >
            <MeetingList
              meetings={meetings}
              onDelete={handleDelete}
              onViewParticipants={(meeting) => setParticipantsMeeting(meeting)}
            />
          </Card>
        )}
      </div>

      {participantsMeeting && (
        <ParticipantsModal
          meetingId={participantsMeeting.uuid}
          meetingTitle={participantsMeeting.title}
          onClose={() => setParticipantsMeeting(null)}
        />
      )}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-white/5" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-white/5" />
      ))}
    </div>
  );
}
