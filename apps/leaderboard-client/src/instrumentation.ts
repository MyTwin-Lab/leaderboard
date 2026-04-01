export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupOtel } = await import('./lib/otel');
    setupOtel();
  }
}
