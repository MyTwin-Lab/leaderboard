export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupOtel } = await import('./lib/otel');
    setupOtel();

    // La distribution s'installe une fois, avant la première requête : routes
    // et crons trouvent ensuite les registres remplis.
    const { installServerDistribution } = await import('./distribution/mytwin.server');
    installServerDistribution();
  }
}
