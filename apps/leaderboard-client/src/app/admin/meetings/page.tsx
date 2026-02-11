'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MeetingList } from '@/components/admin/MeetingList';
import { MeetingForm } from '@/components/admin/MeetingForm';
import { ParticipantsModal } from '@/components/admin/ParticipantsModal';
import type { SyncMeeting, Challenge } from '../../../../../../packages/database-service/domain/entities';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<SyncMeeting[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [participantsMeeting, setParticipantsMeeting] = useState<SyncMeeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
    fetchChallenges();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/sync-meetings');
      const data = await res.json();
      setMeetings(data.meetings ?? []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      setChallenges(data);
    } catch (error) {
      console.error('Error fetching challenges:', error);
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
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;

    try {
      const res = await fetch(`/api/sync-meetings/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchMeetings();
      }
    } catch (error) {
      console.error('Error cancelling meeting:', error);
    }
  };

  if (loading) {
    return <div className="text-white/60">Loading...</div>;
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
            className="rounded-md"
            action={
              <Button onClick={() => setShowForm(true)}>
                + New Meeting
              </Button>
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
