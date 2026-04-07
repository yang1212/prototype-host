// 📄 路径: app/api/cron/cleanup/route.js

import { Redis } from '@upstash/redis';

// 明确配置 Redis 连接
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL 
    || process.env.KV_REST_API_URL 
    || process.env.REDIS_URL
    || process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN 
    || process.env.KV_REST_API_TOKEN
    || process.env.KV_REST_API_READ_ONLY_TOKEN
    || process.env.UPSTASH_REDIS_TOKEN,
});

// 使用 Node.js runtime 避免 Edge Runtime 的网络限制
export const runtime = 'nodejs';

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