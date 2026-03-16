'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TeamAvatars } from '@/components/ui/TeamAvatars';
import { ChallengeProgressBar } from '@/components/ui/ChallengeProgressBar';
import { Calendar, Clock, Users, CheckCircle2, Video, ArrowLeft, ChevronRight } from 'lucide-react';
import type { TeamMember } from '@/lib/types';
import { trackOnboardingStep } from '@/lib/onboarding-track';

interface Challenge {
  uuid: string;
  title: string;
  description?: string;
  status: string;
  start_date: string;
  end_date: string;
  contribution_points_reward: number;
  project_id: string;
}

interface TaskWithAssignees {
  uuid: string;
  title: string;
  description?: string;
  type: 'solo' | 'concurrent';
  status: string;
  parent_task_id?: string;
  assignees: TeamMember[];
}

interface SyncMeeting {
  uuid: string;
  title: string;
  description?: string;
  challenge_id: string;
  start_time: string;
  end_time: string;
  meet_link?: string;
  status: string;
}

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignees[]>([]);
  const [meetings, setMeetings] = useState<SyncMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (challengeId) {
      fetchChallengeData();
      trackOnboardingStep('clicked_challenge');
    }
  }, [challengeId]);

  const fetchChallengeData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchChallenge(),
        fetchTeam(),
        fetchTasks(),
        fetchMeetings(),
      ]);
    } catch (error) {
      console.error('Error fetching challenge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenge = async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
      }
    } catch (error) {
      console.error('Error fetching challenge:', error);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/team`);
      if (res.ok) {
        const data = await res.json();
        setTeam(Array.isArray(data) ? data.map((member: any) => ({
          id: member.uuid,
          fullName: member.full_name,
        })) : []);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?challenge_id=${challengeId}&include=assignees`);
      if (res.ok) {
        const tasksData = await res.json();
        const mapped = (Array.isArray(tasksData) ? tasksData : []).map((task: any) => ({
          ...task,
          assignees: Array.isArray(task.assignees)
            ? task.assignees.map((a: any) => ({ id: a.uuid, fullName: a.full_name }))
            : [],
        }));
        setTasks(mapped);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`/api/sync-meetings?challenge_id=${challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const handleAssignTask = async (taskId: string) => {
    setAssigningTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchTasks();
        trackOnboardingStep('assigned_task');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign');
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setAssigningTaskId(null);
    }
  };

  const calculateCompletion = () => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      processed: 'Processed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const upcomingMeetings = meetings
    .filter(m => ['scheduled', 'in_progress'].includes(m.status))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastMeetings = meetings
    .filter(m => ['completed', 'processed'].includes(m.status))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="text-white/70">Loading challenge...</div>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="text-white/70">Challenge not found</div>
        </div>
      </div>
    );
  }

  const completion = calculateCompletion();
  const parentTasks = tasks.filter(t => !t.parent_task_id);

  return (
    <div className="container mx-auto">
      <Button
        variant="secondary"
        className="mb-6 flex items-center gap-2"
        onClick={() => router.push('/challenges')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenges
      </Button>

      <div className="space-y-6">
        {/* Challenge Info + Team - Layout côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Challenge Info - 2/3 de la largeur */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white mb-2">{challenge.title}</h1>
                    <div className="flex items-center gap-2 text-white/70 mb-3">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
                      </span>
                    </div>
                    {challenge.description && (
                      <p className="text-white/90 leading-relaxed mt-3">{challenge.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-semibold text-white">
                      {challenge.contribution_points_reward.toLocaleString()}{' '}
                      <span className="text-brandCP">CP</span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white/70">Progress</span>
                    <span className="text-sm font-medium text-brandCP">{completion}%</span>
                  </div>
                  <ChallengeProgressBar value={completion / 100} />
                </div>
              </div>
            </Card>
          </div>

          {/* Team - 1/3 de la largeur */}
          <div className="lg:col-span-1">
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-brandCP" />
                  <h2 className="text-xl font-semibold text-white">Team</h2>
                  <span className="text-white/50 text-sm">({team.length})</span>
                </div>
                {team.length === 0 ? (
                  <p className="text-white/70 text-center text-sm">No team members yet</p>
                ) : (
                  <div className="space-y-3">
                    <TeamAvatars members={team} maxDisplay={8} />
                    <div className="space-y-2">
                      {team.map(member => (
                        <div key={member.id} className="text-sm text-white/70 flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-brandCP" />
                          {member.fullName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Tasks Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-6 w-6 text-brandCP" />
            <h2 className="text-2xl font-semibold text-white">Tasks</h2>
            <span className="text-white/50">({tasks.length})</span>
          </div>

          <Card>
            <div className="p-6">
              {tasks.length === 0 ? (
                <p className="text-white/70 text-center">No tasks available</p>
              ) : (
                <div className="space-y-2">
                  {parentTasks.map((task) => {
                    const subtasks = tasks.filter(t => t.parent_task_id === task.uuid);
                    return (
                      <div key={task.uuid} className="space-y-2">
                        {/* Parent Task */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`h-3 w-3 rounded-full shrink-0 ${
                              task.status === 'done' ? 'bg-green-500' : 
                              task.status === 'in_progress' ? 'bg-yellow-500' : 
                              'bg-white/30'
                            }`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-semibold">{task.title}</span>
                                {task.type === 'concurrent' && (
                                  <span className="text-xs text-white/40 italic px-2 py-0.5 bg-white/5 rounded">concurrent</span>
                                )}
                                {subtasks.length > 0 && (
                                  <span className="text-xs text-brandCP bg-brandCP/10 px-2 py-0.5 rounded">
                                    {subtasks.filter(st => st.status === 'done').length}/{subtasks.length} subtasks
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-white/60 mt-1">{task.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {task.assignees.length > 0 && (
                              <TeamAvatars members={task.assignees} maxDisplay={3} />
                            )}
                            {(task.type === 'concurrent' || task.assignees.length === 0) && (
                              <Button
                                size="sm"
                                onClick={() => handleAssignTask(task.uuid)}
                                disabled={assigningTaskId === task.uuid}
                              >
                                {assigningTaskId === task.uuid ? '...' : 'Assign'}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Subtasks */}
                        {subtasks.length > 0 && (
                          <div className="ml-8 space-y-2">
                            {subtasks.map((subtask) => (
                              <div
                                key={subtask.uuid}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition border-l-2 border-brandCP/30"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
                                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                                    subtask.status === 'done' ? 'bg-green-500' : 
                                    subtask.status === 'in_progress' ? 'bg-yellow-500' : 
                                    'bg-white/30'
                                  }`} />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-white/90 text-sm">{subtask.title}</span>
                                      {subtask.type === 'concurrent' && (
                                        <span className="text-xs text-white/30 italic">concurrent</span>
                                      )}
                                    </div>
                                    {subtask.description && (
                                      <p className="text-xs text-white/50 mt-1">{subtask.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {subtask.assignees.length > 0 && (
                                    <TeamAvatars members={subtask.assignees} maxDisplay={3} />
                                  )}
                                  {(subtask.type === 'concurrent' || subtask.assignees.length === 0) && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAssignTask(subtask.uuid)}
                                      disabled={assigningTaskId === subtask.uuid}
                                    >
                                      {assigningTaskId === subtask.uuid ? '...' : 'Assign'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Meetings Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-6 w-6 text-brandCP" />
            <h2 className="text-2xl font-semibold text-white">Meetings</h2>
            <span className="text-white/50">({meetings.length})</span>
          </div>

          <div className="space-y-6">
            {upcomingMeetings.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Upcoming</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {upcomingMeetings.map(meeting => (
                    <div
                      key={meeting.uuid}
                      className="cursor-pointer"
                      onClick={() => router.push(`/sync-meetings/${meeting.uuid}`)}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <h4 className="text-lg font-semibold text-white">{meeting.title}</h4>
                            <Badge label={getStatusLabel(meeting.status)} />
                          </div>

                          {meeting.description && (
                            <p className="text-sm text-white/70 line-clamp-2">{meeting.description}</p>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(meeting.start_time).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Clock className="h-4 w-4" />
                              <span>
                                {new Date(meeting.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                {new Date(meeting.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>

                          {meeting.meet_link && (
                            <Button
                              size="sm"
                              className="flex items-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                trackOnboardingStep('joined_meeting');
                                window.open(meeting.meet_link, '_blank');
                              }}
                            >
                              <Video className="mr-2 h-4 w-4" />
                              Join Meeting
                            </Button>
                          )}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pastMeetings.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Past Meetings</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {pastMeetings.map(meeting => (
                    <div
                      key={meeting.uuid}
                      className="cursor-pointer"
                      onClick={() => router.push(`/sync-meetings/${meeting.uuid}`)}
                    >
                      <Card className="hover:shadow-lg transition-shadow opacity-90">
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <h4 className="text-lg font-semibold text-white">{meeting.title}</h4>
                            <Badge label={getStatusLabel(meeting.status)} />
                          </div>

                          {meeting.description && (
                            <p className="text-sm text-white/70 line-clamp-2">{meeting.description}</p>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(meeting.start_time).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Clock className="h-4 w-4" />
                              <span>
                                {new Date(meeting.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                {new Date(meeting.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {meetings.length === 0 && (
              <Card>
                <div className="p-8 text-center">
                  <Video className="h-12 w-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/70">No meetings scheduled for this challenge</p>
                </div>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
