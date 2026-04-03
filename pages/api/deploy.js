// 📄 路径: pages/api/deploy.js

import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slug, title, html } = req.body;

    if (!slug || !title || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Invalid slug format' });
    }

    const sanitizedHtml = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    const now = Date.now();
    const protoData = {
      html: sanitizedHtml,
      title,
      createdAt: now,
    };

    await kv.set(`proto:${slug}`, protoData);

    const index = await kv.lrange('proto:index', 0, 49);
    const newIndex = [JSON.stringify({ slug, createdAt: now }), ...index.filter(item => {
      const { slug: existingSlug } = JSON.parse(item);
      return existingSlug !== slug;
    })].slice(0, 50);

    await kv.del('proto:index');
    if (newIndex.length > 0) {
      await kv.rpush('proto:index', ...newIndex);
    }

    const url = `https://${process.env.VERCEL_URL || 'localhost:3000'}/p/${slug}`;
    return res.status(200).json({ url, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}