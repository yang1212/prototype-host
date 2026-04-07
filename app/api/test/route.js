import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// 初始化 Redis 客户端 - 使用 Node.js runtime
const redis = new Redis({
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET() {
  try {
    // 测试连接
    const testKey = `test:${Date.now()}`;
    await redis.set(testKey, 'hello-upstash', { ex: 60 });
    const value = await redis.get(testKey);
    await redis.del(testKey);
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Upstash Redis connected!',
      value,
      timestamp: Date.now()
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Redis Test]', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500, headers: corsHeaders });
  }
}