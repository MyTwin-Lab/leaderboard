export interface Contribution {
  title: string;
  type: string;
  description?: string;
  challenge_id: string;
  tags?: string[];
  userId: string;
  commitShas: string[];
}