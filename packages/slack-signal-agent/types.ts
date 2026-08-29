export interface SlackSignalDefinition {
  signal_id: string;
  label: string;
  description?: string;
  reward_cp: number;
}

export interface SlackSignalParticipant {
  user_id: string;
  full_name: string;
}

export interface SlackSignalMessage {
  ts: string;
  /** uuid leaderboard résolu par email, null si l'auteur n'est pas un participant */
  author_user_id: string | null;
  author_name: string;
  text: string;
}

export interface SlackSignalContext {
  challenge: {
    title: string;
    description?: string;
    roadmap?: string;
  };
  project_title?: string;
  participants: SlackSignalParticipant[];
  signals: SlackSignalDefinition[];
  /** Messages en ordre chronologique */
  messages: SlackSignalMessage[];
}

export interface SlackSignalDetection {
  signal_id: string;
  user_id: string;
  message_ts: string;
  justification: string;
}

export interface SlackSignalDetectionResult {
  detections: SlackSignalDetection[];
}
