import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

// GET /api/openapi.json — Serve the OpenAPI spec as JSON (dev only)
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const yamlPath = join(process.cwd(), 'src/app/api/openapi.yaml');
    const yamlContent = readFileSync(yamlPath, 'utf-8');
    const spec = parse(yamlContent);

    return NextResponse.json(spec, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error reading OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to load OpenAPI spec' },
      { status: 500 }
    );
  }
}
