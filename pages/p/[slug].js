// 📄 路径: pages/p/[slug].js

import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export default async function PrototypePage({ params }) {
  const { slug } = params;
  const protoData = await kv.get(`proto:${slug}`);

  if (!protoData) {
    return (
      <div>
        <h1>404</h1>
        <p>Prototype not found</p>
      </div>
    );
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: protoData.html }} />
  );
}

export async function getServerSideProps({ params, res }) {
  const { slug } = params;
  const kv = Redis.fromEnv();
  const protoData = await kv.get(`proto:${slug}`);

  if (!protoData) {
    return {
      notFound: true,
    };
  }

  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';");
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return {
    props: {
      params,
    },
  };
}