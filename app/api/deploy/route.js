// 📄 路径: app/api/deploy/route.js

import { kv } from '@vercel/kv';

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { slug, title, html } = await request.json();

    // 验证字段
    if (!slug || !title || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 验证 slug 格式
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return new Response(JSON.stringify({ error: 'Invalid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // XSS 防护：过滤 <script> 标签和 on* 事件处理器
    const sanitizedHtml = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    const now = Date.now();
    const protoData = {
      html: sanitizedHtml,
      title,
      createdAt: now,
    };

    // 存入 KV
    await kv.set(`proto:${slug}`, protoData);

    // 更新索引列表
    const index = await kv.lrange('proto:index', 0, 49);
    const newIndex = [JSON.stringify({ slug, createdAt: now }), ...index.filter(item => {
      const { slug: existingSlug } = JSON.parse(item);
      return existingSlug !== slug;
    })].slice(0, 50);

    await kv.del('proto:index');
    if (newIndex.length > 0) {
      await kv.rpush('proto:index', ...newIndex);
    }

    const url = `https://${process.env.VERCEL_URL}/p/${slug}`;
    return new Response(JSON.stringify({ url, success: true }), {
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