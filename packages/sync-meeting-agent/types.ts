export interface MeetingParticipantWithUtterances {
  user_id?: string;
  google_user_id: string;
  display_name: string;
  utterances: Utterance[];
}

export interface Utterance {
  text: string;
  start_time: Date;
  end_time?: Date;
}

export interface MeetingAnalysisContext {
  meeting_id: string;
  meeting_title: string;
  challenge_id: string;
  challenge_title?: string;
  challenge_roadmap?: string;
  participants: MeetingParticipantWithUtterances[];
  duration_minutes: number;
}

export interface MeetingAnalysisResult {
  summary: string;
  decisions: Decision[];
  actions: Action[];
  contribution_signals: ContributionSignal[];
}

export interface Decision {
  description: string;
  context?: string;
  mentioned_by?: string[];
}

export interface Action {
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface ContributionSignal {
  user_id?: string;
  display_name: string;
  signal_type: 'coordination' | 'technical_leadership' | 'problem_solving' | 'knowledge_sharing';
  weight: number;
  description?: string;
}
