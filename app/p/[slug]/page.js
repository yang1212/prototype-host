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

// 统一数据获取方式 - 兼容两种存储格式
async function getPrototypeData(slug) {
  const key = `proto:${slug}`;
  
  // 先尝试用 hgetall 获取（哈希格式）
  let data = await redis.hgetall(key);
  
  // 如果为空或不是哈希，尝试用 get 获取（JSON字符串格式）
  if (!data || !data.html) {
    const jsonStr = await redis.get(key);
    if (jsonStr && typeof jsonStr === 'string') {
      try {
        data = JSON.parse(jsonStr);
      } catch {
        data = null;
      }
    } else if (jsonStr && typeof jsonStr === 'object') {
      data = jsonStr;
    }
  }
  
  return data;
}

// 更新访问量 - 兼容两种存储格式
async function incrementViews(slug, data) {
  const key = `proto:${slug}`;
  const currentViews = parseInt(data.views || data.views_count || '0');
  const newViews = currentViews + 1;
  
  try {
    // 先尝试 hset（哈希格式）
    await redis.hset(key, 'views', newViews.toString());
  } catch {
    // 失败则尝试保存为 JSON 字符串
    await redis.set(key, JSON.stringify({ ...data, views: newViews }));
  }
}

export default async function PrototypePage({ params }) {
  try {
    const data = await getPrototypeData(params.slug);
    
    if (!data || !data.html) {
      notFound();
    }
    
    // 增加访问量
    await incrementViews(params.slug, data);
    
    const currentViews = parseInt(data.views || data.views_count || '0');
    
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
              创建于 {new Date(parseInt(data.createdAt || data.created_at || Date.now())).toLocaleString('zh-CN')} 
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
            <a
              href={`/p/${params.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              ↗ 新窗口
            </a>
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
  } catch (error) {
    console.error('[PrototypePage Error]', error);
    notFound();
  }
}