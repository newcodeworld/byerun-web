// api/proxy.js
// 使用 node-fetch v2，确保 package.json 中版本为 ^2.6.7
import fetch from 'node-fetch'; 

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  const backendUrl = 'https://run-lb.tanmasports.com/v1' + req.url;

  const headers = { ...req.headers };
  delete headers['host'];
  delete headers['x-vercel-forwarded-for'];

  try {
    const body = req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined;

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    const data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    res.status(response.status).send(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}

// 👇 权威修复：添加 externalResolver
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    // 这是解决 405 的关键配置
    externalResolver: true, 
  },
};
