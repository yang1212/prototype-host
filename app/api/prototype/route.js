import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Edge Runtime 下使用原生 fetch
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL 
    || process.env.KV_REST_API_URL 
    || process.env.REDIS_URL
    || process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN 
    || process.env.KV_REST_API_TOKEN
    || process.env.KV_REST_API_READ_ONLY_TOKEN
    || process.env.UPSTASH_REDIS_TOKEN,
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.exp(retryCount) * 100,
  },
});

// 使用 Node.js runtime 避免 Edge Runtime 的网络限制
export const runtime = 'nodejs';

// CORS 响应头配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 创建带 CORS 头的响应
function createCorsResponse(data, status = 200) {
  return NextResponse.json(data, { 
    status,
    headers: corsHeaders 
  });
}

// 处理预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const { slug, title, html } = await req.json();
    
    if (!slug || !html) {
      return createCorsResponse(
        { error: 'Missing slug or html' }, 
        400
      );
    }
    
    // XSS 防护
    const safeHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '');
    
    const key = `proto:${slug}`;
    
    // 存储原型数据
    await redis.hset(key, {
      html: safeHtml,
      title: title || slug,
      createdAt: Date.now().toString(),
      views: '0'
    });
    
    // 使用 Sorted Set 维护索引 - 更可靠，自动按时间排序
    const indexKey = 'proto:index:zset';
    const metaKey = `proto:meta:${slug}`;
    const now = Date.now();
    
    try {
      // 存储元数据
      await redis.hset(metaKey, {
        slug,
        title: title || slug,
        createdAt: now.toString()
      });
      // 设置 7 天过期
      await redis.expire(metaKey, 7 * 24 * 60 * 60);
      
      // 添加到 Sorted Set（分数为时间戳，最新的在前面）
      await redis.zadd(indexKey, { score: now, member: slug });
      
      // 只保留最近 50 个
      const count = await redis.zcard(indexKey);
      if (count > 50) {
        await redis.zremrangebyrank(indexKey, 0, count - 51);
      }
      
      console.log('[Prototype API] Index updated:', { slug, now });
    } catch (indexError) {
      console.error('[Prototype API] Index error:', indexError.message);
    }
    
    // 使用生产域名，避免使用 Vercel 默认项目 URL
    const baseUrl = 'https://prototype-host.vercel.app';
    
    return createCorsResponse({
      success: true,
      url: `${baseUrl}/p/${slug}`,
      slug,
      message: 'Prototype deployed successfully'
    });
    
  } catch (error) {
    console.error('[Prototype API]', error);
    return createCorsResponse(
      { error: error.message }, 
      500
    );
  }
}

// 获取原型列表
export async function GET() {
  try {
    const indexKey = 'proto:index:zset';
    
    // 从 Sorted Set 获取最近 50 个（分数降序）
    const slugs = await redis.zrevrange(indexKey, 0, 49) || [];
    console.log('[Prototype API] Slugs from zset:', slugs.length);
    
    // 获取每个 slug 的元数据
    const prototypes = [];
    for (const slug of slugs) {
      try {
        const meta = await redis.hgetall(`proto:meta:${slug}`);
        if (meta && meta.slug) {
          prototypes.push({
            slug: meta.slug,
            title: meta.title || meta.slug,
            createdAt: meta.createdAt || Date.now().toString()
          });
        }
      } catch (e) {
        console.error('[Prototype API] Failed to get meta for:', slug);
      }
    }
    
    console.log('[Prototype API] Prototypes found:', prototypes.length);
    
    return createCorsResponse({
      success: true,
      count: prototypes.length,
      prototypes
    });
  } catch (error) {
    console.error('[Prototype API] GET error:', error);
    return createCorsResponse(
      { error: error.message }, 
      500
    );
  }
}