const express = require('express');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');

const app = express();

// 日志记录器 - 仅控制台输出（Vercel 日志系统会自动收集）
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [new transports.Console()]
});

// morgan 输出到 logger
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// 请求体大小限制
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS 预检
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });
        res.sendStatus(200);
    } else {
        next();
    }
});

// 代理所有请求
app.all('*', async (req, res) => {
    const originalUrl = req.originalUrl;
    const backendUrl = `https://run-lb.tanmasports.com/v1${originalUrl}`;

    logger.info(`Forwarding ${req.method} ${originalUrl} -> ${backendUrl}`);

    // 准备请求头
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length']; // 让 fetch 自动设置

    let body = undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.body && Object.keys(req.body).length !== 0) {
            body = JSON.stringify(req.body);
            headers['content-type'] = 'application/json';
        } else if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
            body = req.body;
        }
    }

    try {
        const response = await fetch(backendUrl, {
            method: req.method,
            headers,
            body
        });

        // 读取响应体（支持二进制）
        const arrayBuffer = await response.arrayBuffer();
        const responseBody = Buffer.from(arrayBuffer);

        // 透传后端响应头（过滤 hop-by-hop 头）
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!['connection', 'transfer-encoding', 'keep-alive'].includes(lowerKey)) {
                responseHeaders[key] = value;
            }
        });

        // 追加 CORS 头
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        responseHeaders['Access-Control-Allow-Headers'] = '*';

        res.status(response.status).set(responseHeaders).send(responseBody);
    } catch (error) {
        logger.error(`代理错误: ${error.message}`);
        res.status(500).send('Internal Server Error');
    }
});

// 导出 Express 应用供 Vercel 无服务器函数使用
module.exports = app;
