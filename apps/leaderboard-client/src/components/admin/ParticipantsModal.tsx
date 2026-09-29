'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Modal } from '@/components/vitrine/Modal';
import type { MeetingParticipant } from '../../../../../packages/database-service/domain/entities';

import './admin-forms-vitrine.css';

interface ParticipantsModalProps {
  meetingId: string;
  meetingTitle: string;
  onClose: () => void;
}

/** Les participants d'une réunion, en lecture. Sur la modale vitrine. */
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
    <Modal
      open
      onClose={onClose}
      title="Participants"
      subtitle={meetingTitle}
      icon={<Users />}
      size="sm"
      center
      actions={
        <button type="button" className="v-btn-quiet" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading ? (
        <p className="v-quiet">Loading...</p>
      ) : participants.length === 0 ? (
        <p className="v-quiet">No participants yet</p>
      ) : (
        <div className="v-rows v-af-scroll">
          {participants.map((p) => (
            <div key={p.uuid} className="v-row" data-quiet="true">
              <div className="v-af-avatar">{p.display_name.charAt(0).toUpperCase()}</div>
              <div className="v-row-text">
                <span className="v-row-title">{p.display_name}</span>
                <span className="v-row-meta">{p.google_user_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
