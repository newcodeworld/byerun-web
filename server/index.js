const express = require('express');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');

const app = express();

const logger = createLogger({
    level: 'info',
    format: format.combine(format.timestamp(), format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)),
    transports: [new transports.Console()]
});

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
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

// 代理核心
app.all('*', async (req, res) => {
    const originalUrl = req.originalUrl; // 包含查询参数
    const backendUrl = `https://run-lb.tanmasports.com/v1${originalUrl}`;

    logger.info(`Forwarding ${req.method} ${originalUrl} -> ${backendUrl}`);

    // 构建请求头
    const headers = { ...req.headers };
    // 关键修复：设置正确的 Host 头
    headers.host = 'run-lb.tanmasports.com';
    // 删除可能导致 fetch 问题的 hop-by-hop 头
    delete headers['connection'];
    delete headers['transfer-encoding'];
    delete headers['content-length']; // fetch 会自动设置

    let body = undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
        // 如果有请求体，转为 Buffer 或字符串
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

        // 如果后端返回错误状态码，记录响应体前 500 字符帮助调试
        if (response.status >= 400) {
            logger.warn(`Backend ${response.status} for ${req.method} ${originalUrl}: ${responseBody.toString('utf-8').slice(0, 500)}`);
        }

        // 透传后端响应头（过滤 hop-by-hop）
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!['connection', 'transfer-encoding', 'keep-alive'].includes(lowerKey)) {
                responseHeaders[key] = value;
            }
        });

        // 添加 CORS 头
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        responseHeaders['Access-Control-Allow-Headers'] = '*';

        res.status(response.status).set(responseHeaders).send(responseBody);
    } catch (error) {
        logger.error(`Proxy error: ${error.message}`);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = app;
