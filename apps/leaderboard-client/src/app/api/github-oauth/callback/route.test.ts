import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockHandleOAuthCallback } = vi.hoisted(() => ({ mockHandleOAuthCallback: vi.fn() }));

vi.mock('@/lib/server/integrations', () => ({ handleOAuthCallback: mockHandleOAuthCallback }));

import { GET } from './route';

describe('GET /api/github-oauth/callback (compatibility)', () => {
  it('hands the GitHub OAuth return to the generic integration callback', async () => {
    const response = NextResponse.redirect('http://localhost/contributors/me?tab=integrations');
    mockHandleOAuthCallback.mockResolvedValue(response);
    const req = new NextRequest('http://localhost/api/github-oauth/callback?code=c&state=s');

    expect(await GET(req)).toBe(response);
    expect(mockHandleOAuthCallback).toHaveBeenCalledWith(req, 'github');
  });
});
