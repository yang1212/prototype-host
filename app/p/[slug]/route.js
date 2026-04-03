// 📄 路径: app/p/[slug]/route.js

import { kv } from '@vercel/kv';

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const { slug } = params;
    const protoData = await kv.get(`proto:${slug}`);

    if (!protoData) {
      return new Response(JSON.stringify({ error: 'Prototype not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(protoData.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}