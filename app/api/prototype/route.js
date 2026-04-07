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
    
    // 维护索引列表 - 简化逻辑，直接使用 Set 保证唯一性
    const indexKey = 'proto:index';
    const indexItem = JSON.stringify({
      slug,
      title: title || slug,
      createdAt: Date.now().toString()
    });
    
    try {
      // 先移除旧记录（如果存在）
      const existingIndex = await redis.lrange(indexKey, 0, -1);
      for (const item of existingIndex) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.slug === slug) {
            await redis.lrem(indexKey, 0, item);
          }
        } catch {
          // 忽略解析错误的条目
        }
      }
      
      // 添加到列表头部
      await redis.lpush(indexKey, indexItem);
      
      // 限制列表长度为 50
      await redis.ltrim(indexKey, 0, 49);
    } catch (indexError) {
      console.error('[Prototype API] Index update error:', indexError);
      // 索引更新失败不阻断主流程
    }
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : `http://localhost:3000`;
    
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
    console.log('[Prototype API] Fetching list from Redis...');
    console.log('[Prototype API] Redis URL exists:', !!process.env.KV_REST_API_URL);
    
    const list = await redis.lrange('proto:index', 0, -1) || [];
    console.log('[Prototype API] Raw list:', list);
    
    const prototypes = list.map(item => {
      try {
        return JSON.parse(item);
      } catch (e) {
        console.error('[Prototype API] Failed to parse item:', item, e.message);
        return null;
      }
    }).filter(Boolean);
    
    console.log('[Prototype API] Parsed prototypes:', prototypes);
    
    return createCorsResponse({
      success: true,
      count: prototypes.length,
      prototypes
    });
  } catch (error) {
    console.error('[Prototype API] GET error:', error);
    return createCorsResponse(
      { error: error.message, details: error.stack }, 
      500
    );
  }
}