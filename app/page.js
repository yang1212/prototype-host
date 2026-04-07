import { Redis } from '@upstash/redis';
import Link from 'next/link';

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

export const dynamic = 'force-dynamic';

export default async function Home() {
  let prototypes = [];
  
  try {
    const list = await redis.lrange('proto:index', 0, -1) || [];
    prototypes = list.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error('[Home Page]', error);
    prototypes = [];
  }
  
  return (
    <div style={{
      maxWidth: '800px',
      margin: '40px auto',
      padding: '0 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#111827',
          margin: '0 0 8px'
        }}>
          🎨 我的原型库
        </h1>
        <p style={{
          color: '#6b7280',
          margin: 0
        }}>
          单项目托管 · 自动清理 · 永久访问
        </p>
      </header>
      
      {prototypes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
          <h2 style={{ margin: '0 0 8px', color: '#111827' }}>
            暂无原型
          </h2>
          <p style={{ color: '#6b7280', margin: 0 }}>
            在 AI 对话框中描述你的需求，即可生成第一个原型！
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {prototypes.map((proto) => (
            <Link
              key={proto.slug}
              href={`/p/${proto.slug}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                textDecoration: 'none',
                transition: 'box-shadow 0.2s'
              }}
            >
              <h3 style={{
                margin: '0 0 4px',
                fontSize: '16px',
                fontWeight: 600,
                color: '#2563eb'
              }}>
                {proto.title}
              </h3>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#9ca3af'
              }}>
                {new Date(parseInt(proto.createdAt || proto.created_at || Date.now())).toLocaleString('zh-CN')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}