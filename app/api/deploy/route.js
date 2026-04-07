// 📄 路径: app/api/deploy/route.js

import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

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

// CORS 响应头配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 处理预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  try {
    const { slug, title, html } = await request.json();

    // 验证字段
    if (!slug || !title || !html) {
      return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    // 验证 slug 格式
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid slug format' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      });
    }

    // XSS 防护：过滤 <script> 标签和 on* 事件处理器
    const sanitizedHtml = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    const now = Date.now();
    const key = `proto:${slug}`;
    
    // 统一使用哈希格式存储
    await kv.hset(key, {
      html: sanitizedHtml,
      title,
      createdAt: now.toString(),
      views: '0'
    });

    // 更新索引列表
    try {
      // 移除旧记录
      const index = await kv.lrange('proto:index', 0, -1);
      for (const item of index) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.slug === slug) {
            await kv.lrem('proto:index', 0, item);
          }
        } catch {
          // 忽略解析错误
        }
      }
      
      // 添加到头部
      await kv.lpush('proto:index', JSON.stringify({ 
        slug, 
        title,
        createdAt: now.toString() 
      }));
      
      // 限制长度
      await kv.ltrim('proto:index', 0, 49);
    } catch (indexError) {
      console.error('[Deploy API] Index error:', indexError);
    }

    // 使用生产域名
    const baseUrl = 'https://prototype-host.vercel.app';
    const url = `${baseUrl}/p/${slug}`;
    return new NextResponse(JSON.stringify({ url, success: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  } catch (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });
  }
}