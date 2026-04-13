export interface ThemeConfig {
  appName: string;
  logoPath: string;
  colors: {
    brandCP: string;
    primary100: string;
    primary200: string;
    primary300: string;
    background: string;
    backgroundDark: string;
    gradientFrom: string;
    gradientVia: string;
    gradientTo: string;
  };
  nav: {
    about: string;
    leaderboard: string;
    challenges: string;
  };
}
