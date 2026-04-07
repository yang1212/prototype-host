import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// 初始化 Redis 客户端
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
    });
  } catch (error) {
    console.error('[Redis Test]', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}