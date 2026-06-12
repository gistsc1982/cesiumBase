/**
 * 天地图地形数据代理服务器
 *
 * 解决天地图服务器端 Token 不能在浏览器中使用的问题
 *
 * 使用方法：
 * 1. 安装依赖: npm install express cors
 * 2. 启动服务: node server/terrain-proxy.js
 * 3. 服务运行在: http://127.0.0.1:3001
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3001;

// 启用 CORS
app.use(cors());

// 天地图配置
const TIANDITU_CONFIG = {
  token: '843e3a9600683cbcec923ce19d352e03',
  baseUrl: 'https://t{s}.tianditu.gov.cn',
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
};

/**
 * 代理天地图地形数据请求
 * 路径: /terrain?x={x}&y={y}&l={level}
 */
app.get('/terrain', (req, res) => {
  const { x, y, l } = req.query;

  if (!x || !y || !l) {
    return res.status(400).json({
      error: 'Missing required parameters: x, y, l'
    });
  }

  // 标记响应是否已发送
  let headersSent = false;

  // 选择子域名（轮询）
  const subdomainIndex = parseInt(x) % TIANDITU_CONFIG.subdomains.length;
  const subdomain = TIANDITU_CONFIG.subdomains[subdomainIndex];

  // 构造天地图 URL
  const tiandituUrl = `${TIANDITU_CONFIG.baseUrl.replace('{s}', subdomain)}/mapservice/swdx?T=elv_c&tk=${TIANDITU_CONFIG.token}&x=${x}&y=${y}&l=${l}`;

  console.log(`[Proxy] Forwarding: ${tiandituUrl}`);

  // 转发请求到天地图
  const request = https.get(tiandituUrl, (response) => {
    if (headersSent) return;

    // 设置响应头
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 检查响应状态
    if (response.statusCode !== 200) {
      console.error(`[Proxy] ❌ Status ${response.statusCode} for: x=${x}, y=${y}, l=${l}`);
      headersSent = true;
      return res.status(response.statusCode).send('Error fetching terrain data');
    }

    // 转发响应数据
    const chunks = [];
    response.on('data', (chunk) => {
      chunks.push(chunk);
    });

    response.on('end', () => {
      if (headersSent) return;
      const buffer = Buffer.concat(chunks);
      console.log(`[Proxy] ✅ Success: ${buffer.length} bytes for x=${x}, y=${y}, l=${l}`);
      headersSent = true;
      res.send(buffer);
    });
  });

  request.on('error', (error) => {
    if (headersSent) return;
    console.error('[Proxy] ❌ Request failed:', error.message);
    headersSent = true;
    res.status(500).json({
      error: 'Failed to fetch terrain data',
      message: error.message
    });
  });

  request.setTimeout(10000, () => {
    if (headersSent) return;
    request.destroy();
    console.error('[Proxy] ⏱️ Timeout for:', { x, y, l });
    headersSent = true;
    res.status(504).json({
      error: 'Timeout',
      message: 'Tianditu request timeout'
    });
  });
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Tianditu Terrain Proxy',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   天地图地形代理服务器已启动                          ║
║                                                       ║
║   服务地址: http://localhost:${PORT}                   ║
║   地形接口: http://localhost:${PORT}/terrain          ║
║                                                       ║
║   使用示例:                                           ║
║   GET /terrain?x=100&y=200&l=10                      ║
║                                                       ║
║   按 Ctrl+C 停止服务                                  ║
╚═══════════════════════════════════════════════════════╝
  `);
});
