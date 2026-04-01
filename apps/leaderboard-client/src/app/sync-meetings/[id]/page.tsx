'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  Users,
  Brain,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Target,
  Loader2,
} from 'lucide-react';

// --- Types ---

interface SyncMeeting {
  uuid: string;
  title: string;
  description?: string;
  challenge_id: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: string;
  created_by: string;
}

interface MeetingParticipant {
  uuid: string;
  sync_meeting_id: string;
  user_id?: string;
  google_user_id: string;
  display_name: string;
}

interface Decision {
  description: string;
  context?: string;
  mentioned_by?: string[];
}

interface Action {
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface ContributionSignal {
  user_id?: string;
  display_name: string;
  signal_type: 'coordination' | 'technical_leadership' | 'problem_solving' | 'knowledge_sharing';
  weight: number;
  description?: string;
}

interface MeetingAnalysis {
  uuid: string;
  summary?: string;
  decisions?: Decision[];
  actions?: Action[];
  contribution_signals?: ContributionSignal[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
}

// --- Helpers ---

type AnalysisTab = 'summary' | 'details';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  processed: 'Processed',
  cancelled: 'Cancelled',
};

const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing…',
  completed: 'Completed',
  failed: 'Failed',
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  coordination: 'Coordination',
  technical_leadership: 'Technical Leadership',
  problem_solving: 'Problem Solving',
  knowledge_sharing: 'Knowledge Sharing',
};

function getPriorityStyle(priority?: string): string {
  switch (priority) {
    case 'high':
      return 'text-red-400 bg-red-500/10 border border-red-500/20';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20';
    case 'low':
      return 'text-green-400 bg-green-500/10 border border-green-500/20';
    default:
      return 'text-white/60 bg-white/5 border border-white/10';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Page ---

export default function SyncMeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<SyncMeeting | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');

  useEffect(() => {
    if (meetingId) fetchAll();
  }, [meetingId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMeeting(), fetchParticipants(), fetchAnalysis()]);
    } catch (error) {
      console.error('Error fetching meeting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeeting = async () => {
    try {
      const res = await fetch(`/api/sync-meetings/${meetingId}`);
      if (res.ok) {
        const data = await res.json();
        setMeeting(data.meeting);
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/sync-meetings/${meetingId}/participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const fetchAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/sync-meetings/${meetingId}/analysis`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } catch {
      // Analysis may not exist yet
    } finally {
      setAnalysisLoading(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-white/10" />
          <div className="h-4 w-96 rounded bg-white/5" />
          <div className="h-32 rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="mx-auto mt-10 max-w-2xl">
        <div className="flex items-center justify-center text-white/70">Meeting not found</div>
      </div>
    );
  }

  const isLive = ['scheduled', 'in_progress'].includes(meeting.status);

  const tabs: { value: AnalysisTab; label: string }[] = [
    { value: 'summary', label: 'Summary' },
    { value: 'details', label: 'Details' },
  ];

  return (
    <div className="mx-auto mt-4 max-w-2xl sm:mt-6">
      {/* Back button */}
      <Button
        variant="secondary"
        className="mb-6 flex items-center gap-2"
        onClick={() => router.push(`/challenges/${meeting.challenge_id}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenge
      </Button>

      <div className="space-y-4 sm:space-y-6">
        {/* ── Top: Meeting info + Participants side by side ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Left — Meeting card (same style as challenge page meeting cards) */}
          <Card>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-semibold text-white sm:text-base">{meeting.title}</h4>
                <Badge label={STATUS_LABELS[meeting.status] || meeting.status} />
              </div>

              {meeting.description && (
                <p className="text-xs text-white/70 line-clamp-2">{meeting.description}</p>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{new Date(meeting.start_time).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                  </span>
                </div>
              </div>

              {meeting.meet_link && isLive && (
                <Button
                  size="sm"
                  className="flex items-center"
                  onClick={() => window.open(meeting.meet_link, '_blank')}
                >
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting
                </Button>
              )}
            </div>
          </Card>

          {/* Right — Participants (avatar badges like concurrent tasks) */}
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-brandCP" />
                <span className="text-sm font-semibold text-white">Participants</span>
                <span className="text-white/50 text-xs">({participants.length})</span>
              </div>

              {participants.length === 0 ? (
                <p className="text-xs text-white/70 text-center">No participants yet</p>
              ) : (
                <div className="flex -space-x-3 flex-wrap">
                  {participants.map((p, index) => (
                    <div
                      key={p.uuid}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brandCP text-xs font-semibold text-slate-900 ring-1 ring-slate-900"
                      style={{ zIndex: participants.length - index }}
                      title={p.display_name}
                    >
                      {p.display_name
                        .split(' ')
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Analysis section ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-brandCP" />
            <h2 className="text-base font-semibold text-white sm:text-lg">Analysis</h2>
            {analysis && (
              <Badge label={ANALYSIS_STATUS_LABELS[analysis.status] || analysis.status} />
            )}
          </div>

          {analysisLoading ? (
            <div className="rounded-md bg-white/5 p-8 flex items-center justify-center gap-2 text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading analysis…</span>
            </div>
          ) : !analysis ? (
            <div className="rounded-md bg-white/5 p-8 text-center">
              <Brain className="h-10 w-10 text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/70 sm:text-sm">No analysis available yet</p>
            </div>
          ) : analysis.status === 'failed' ? (
            <div className="rounded-md bg-white/5 p-6 space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Analysis failed</span>
              </div>
              {analysis.error_message && (
                <p className="text-xs text-white/60">{analysis.error_message}</p>
              )}
            </div>
          ) : analysis.status !== 'completed' ? (
            <div className="rounded-md bg-white/5 p-8 flex items-center justify-center gap-2 text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analysis is {analysis.status}…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab switcher */}
              <div className="flex items-center justify-center gap-0 rounded-md bg-white/5 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all sm:px-6 sm:py-2 sm:text-sm ${
                      activeTab === tab.value
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'summary' ? (
                <div className="rounded-md bg-white/5 p-4 sm:p-5">
                  {analysis.summary ? (
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{analysis.summary}</p>
                  ) : (
                    <p className="text-xs text-white/50 text-center">No summary available</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Decisions */}
                  {analysis.decisions && analysis.decisions.length > 0 && (
                    <div className="rounded-md bg-white/5 p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-brandCP" />
                        Decisions
                        <span className="text-white/50 text-xs font-normal">({analysis.decisions.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {analysis.decisions.map((d, i) => (
                          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                            <p className="text-sm text-white font-medium">{d.description}</p>
                            {d.context && (
                              <p className="text-xs text-white/60">{d.context}</p>
                            )}
                            {d.mentioned_by && d.mentioned_by.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {d.mentioned_by.map((name, j) => (
                                  <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-brandCP/10 text-brandCP">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {analysis.actions && analysis.actions.length > 0 && (
                    <div className="rounded-md bg-white/5 p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-brandCP" />
                        Actions
                        <span className="text-white/50 text-xs font-normal">({analysis.actions.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {analysis.actions.map((a, i) => (
                          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-white font-medium flex-1">{a.description}</p>
                              {a.priority && (
                                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getPriorityStyle(a.priority)}`}>
                                  {a.priority}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-white/60">
                              {a.assignee && <span>Assignee: <span className="text-white/80">{a.assignee}</span></span>}
                              {a.deadline && <span>Deadline: <span className="text-white/80">{a.deadline}</span></span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contribution Signals */}
                  {analysis.contribution_signals && analysis.contribution_signals.length > 0 && (
                    <div className="rounded-md bg-white/5 p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-brandCP" />
                        Contribution Signals
                        <span className="text-white/50 text-xs font-normal">({analysis.contribution_signals.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {analysis.contribution_signals.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brandCP text-[10px] font-semibold text-slate-900 shrink-0">
                              {s.display_name
                                .split(' ')
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-white font-medium">{s.display_name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                                  {SIGNAL_TYPE_LABELS[s.signal_type] || s.signal_type}
                                </span>
                              </div>
                              {s.description && (
                                <p className="text-xs text-white/60 mt-0.5 truncate">{s.description}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-base font-semibold text-brandCP">{s.weight}</div>
                              <div className="text-[10px] text-white/40">weight</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty details state */}
                  {(!analysis.decisions || analysis.decisions.length === 0) &&
                   (!analysis.actions || analysis.actions.length === 0) &&
                   (!analysis.contribution_signals || analysis.contribution_signals.length === 0) && (
                    <div className="rounded-md bg-white/5 p-6 text-center">
                      <p className="text-xs text-white/50 sm:text-sm">No details available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
