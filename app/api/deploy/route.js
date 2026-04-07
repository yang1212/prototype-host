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