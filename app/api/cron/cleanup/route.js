// 📄 路径: app/api/cron/cleanup/route.js

import { kv } from '@vercel/kv';

export const runtime = 'edge';

export async function GET(request) {
  try {
    // 验证 Vercel Cron Auth Header
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const index = await kv.lrange('proto:index', 0, -1);
    
    let cleanedCount = 0;
    const remainingItems = [];

    for (const item of index) {
      const { slug, createdAt } = JSON.parse(item);
      if (createdAt < sevenDaysAgo) {
        // 删除过期的原型
        await kv.del(`proto:${slug}`);
        cleanedCount++;
      } else {
        remainingItems.push(item);
      }
    }

    // 更新索引列表
    await kv.del('proto:index');
    if (remainingItems.length > 0) {
      await kv.rpush('proto:index', ...remainingItems);
    }

    return new Response(JSON.stringify({ cleanedCount, remainingCount: remainingItems.length }), {
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