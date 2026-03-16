import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/index.js';

export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    const clientId = config.googleWorkspace.oauthClientId;
    const clientSecret = config.googleWorkspace.oauthClientSecret;
    const redirectUri = config.googleWorkspace.oauthRedirectUri;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth credentials not configured');
    }

    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'select_account',
    });
  }

  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async getUserInfo(accessToken: string) {
    this.oauth2Client.setCredentials({ access_token: accessToken });

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo = await response.json();

    return {
      google_user_id: userInfo.id,
      email: userInfo.email,
      display_name: userInfo.name,
    };
  }
}
