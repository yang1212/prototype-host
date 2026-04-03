// 📄 路径: app/api/test/route.js

export const runtime = 'edge';

export async function GET(request) {
  try {
    return new Response(JSON.stringify({ message: 'Service is running', timestamp: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}