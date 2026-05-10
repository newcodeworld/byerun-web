// api/proxy.js
import fetch from 'node-fetch';

// 1. 确保处理 OPTIONS 预检
export default async function handler(req, res) {
  // 👇 这一行是关键：必须允许 OPTIONS 方法通过
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  const backendUrl = 'https://run-lb.tanmasports.com/v1' + req.url;

  // 2. 处理请求头
  const headers = { ...req.headers };
  delete headers['host'];
  delete headers['x-vercel-forwarded-for'];

  try {
    // 3. 关键：根据 req.method 动态传递方法
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined;

    const response = await fetch(backendUrl, {
      method: req.method, // 👈 这里必须是 req.method，不能写死
      headers: headers,
      body: body,
    });

    const data = await response.text();

    // 4. 设置 CORS 头（这一步现在能执行到了）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
