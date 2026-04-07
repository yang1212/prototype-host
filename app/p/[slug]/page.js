import { Redis } from '@upstash/redis';
import { notFound } from 'next/navigation';

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

export default async function PrototypePage({ params }) {
  const key = `proto:${params.slug}`;
  const data = await redis.hgetall(key);
  
  if (!data || !data.html) {
    notFound();
  }
  
  // 增加访问量
  const currentViews = parseInt(data.views || '0');
  await redis.hset(key, 'views', (currentViews + 1).toString());
  
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#f5f5f5'
    }}>
      <header style={{
        padding: '12px 20px',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: 600,
            color: '#111827'
          }}>
            🎨 {data.title || params.slug}
          </h1>
          <p style={{ 
            margin: '4px 0 0', 
            fontSize: '12px', 
            color: '#6b7280'
          }}>
            创建于 {new Date(parseInt(data.createdAt)).toLocaleString('zh-CN')} 
            {' · '}👁️ {currentViews + 1} 次查看
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <a 
            href="/"
            style={{
              padding: '6px 12px',
              background: '#f3f4f6',
              color: '#374151',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            ← 返回列表
          </a>
          <button
            onClick={() => window.open(`/p/${params.slug}`, '_blank')}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            ↗ 新窗口
          </button>
        </div>
      </header>
      
      <iframe
        srcDoc={data.html}
        style={{
          flex: 1,
          border: 'none',
          width: '100%',
          background: 'white'
        }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        title={params.slug}
      />
    </div>
  );
}