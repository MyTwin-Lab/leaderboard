// domain/entities.ts

export interface Project {
  uuid: string;
  title: string;
  description?: string;
  created_at: Date;
}

export interface Repo {
  uuid: string;
  title: string;
  type: string;
  external_repo_id?: string;
  project_id: string; // FK -> projects.uuid
}

export interface ChallengeRepo {
  challenge_id: string; // FK -> challenges.uuid
  repo_id: string;      // FK -> repos.uuid
}

export interface ChallengeTeam {
  challenge_id: string; // FK -> challenges.uuid
  user_id: string;      // FK -> users.uuid
}

export interface Challenge {
  uuid: string;
  index?: number;
  title: string;
  status: string;
  start_date: Date;
  end_date: Date;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  completion: number;
  project_id: string; // FK -> projects.uuid
}

export interface Contribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  evaluation?: any; // JSON structure – à typer plus tard
  tags?: string[];
  reward: number;
  user_id: string;      // FK -> users.uuid
  challenge_id: string; // FK -> challenges.uuid
  submitted_at: Date;
}

export interface User {
  uuid: string;
  role: string;
  full_name: string;
  github_username: string;
  bio?: string;
  password_hash?: string;
  created_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface Task {
  uuid: string;
  challenge_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  type: "solo" | "concurrent";
  status: "todo" | "done";
  created_at: Date;
}

export interface TaskAssignee {
  task_id: string;
  user_id: string;
  assigned_at: Date;
}
