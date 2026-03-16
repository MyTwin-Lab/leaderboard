'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { User, Challenge } from '../../../../../packages/database-service/domain/entities';

interface ContributionFormProps {
  users: User[];
  challenges: Challenge[];
  onSubmit: (contribution: any) => void;
  onCancel: () => void;
}

export function ContributionForm({ users, challenges, onSubmit, onCancel }: ContributionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'code',
    description: '',
    user_id: '',
    challenge_id: '',
    reward: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting contribution:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-white/10 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-white mb-6">Add Manual Contribution</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
              placeholder="Contribution title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Type *
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
            >
              <option value="code">Code</option>
              <option value="model">Model</option>
              <option value="dataset">Dataset</option>
              <option value="docs">Documentation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
              placeholder="Contribution description (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              User *
            </label>
            <select
              required
              value={formData.user_id}
              onChange={(e) => handleChange('user_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.uuid} value={user.uuid}>
                  {user.full_name} (@{user.github_username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Challenge *
            </label>
            <select
              required
              value={formData.challenge_id}
              onChange={(e) => handleChange('challenge_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
            >
              <option value="">Select a challenge</option>
              {challenges.map((challenge) => (
                <option key={challenge.uuid} value={challenge.uuid}>
                  {challenge.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Reward (CP) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.reward}
              onChange={(e) => handleChange('reward', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brandCP"
              placeholder="0"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Contribution'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
