import { NextResponse } from 'next/server';

// GET /api/docs — Scalar interactive docs (dev only)
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Leaderboard API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/api/openapi.json" data-configuration='${JSON.stringify({ theme: 'kepler', layout: 'modern', darkMode: true })}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
