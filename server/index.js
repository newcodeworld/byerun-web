// Vercel Serverless Function 不需要 require express
// 只需要导出一个异步函数

// 注意：node-fetch v3+ 需要使用 import，但在 Vercel Node.js 环境中可以直接引用
import fetch from 'node-fetch'; // 如果报错，可以尝试 const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

// Serverless 函数没有全局日志实例，直接使用 console 即可
// 如果需要更复杂的日志，Vercel 的控制台会自动捕获 console 输出

export default async function handler(req, res) {
  // 1. 处理预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  // 2. 构建后端 URL
  // Vercel 环境下，req.url 是路径+查询参数
  const backendUrl = 'https://run-lb.tanmasports.com/v1' + req.url;

  // 3. 准备请求头
  const { ...headers } = req.headers;
  // 删除 Vercel 平台特定的内部头（可选，防止转发冲突）
  delete headers['x-vercel-forwarded-for']; 
  delete headers['x-vercel-id'];
  // 必须删除 host，否则后端会因为 Host 不匹配而拒绝
  delete headers['host']; 

  try {
    // 4. 发起代理请求
    // 注意：Serverless 函数中 req.body 在 Vercel 中通常已经是解析好的对象
    const body = req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined;

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    const data = await response.text(); // 使用 text() 以保持原始格式（包括 HTML/JSON）

    // 5. 返回响应给客户端
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // 将后端的状态码和数据返回
    res.status(response.status).send(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
}

// Vercel 配置（可选）
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // 对应你原来的 limit: '10mb'
    },
    // 如果你的请求体很大，可能需要关闭 bodyParser 让你手动处理
    // bodyParser: false 
  },
};
