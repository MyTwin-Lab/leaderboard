'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { MeetingParticipant } from '../../../../../packages/database-service/domain/entities';

interface ParticipantsModalProps {
  meetingId: string;
  meetingTitle: string;
  onClose: () => void;
}

export function ParticipantsModal({ meetingId, meetingTitle, onClose }: ParticipantsModalProps) {
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchParticipants();
  }, [meetingId]);

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/sync-meetings/${meetingId}/participants`);
      const data = await res.json();
      setParticipants(data.participants ?? []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Participants — {meetingTitle}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>

        {loading ? (
          <p className="py-4 text-center text-sm text-white/40">Loading...</p>
        ) : participants.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">No participants yet</p>
        ) : (
          <div className="max-h-64 divide-y divide-white/5 overflow-y-auto">
            {participants.map((p) => (
              <div key={p.uuid} className="flex items-center gap-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brandCP/10 text-xs font-bold text-brandCP">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{p.display_name}</div>
                  <div className="text-xs text-white/40">{p.google_user_id}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
