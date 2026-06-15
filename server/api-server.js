/**
 * Express API 服务器
 *
 * 为前端提供配置文件的读写 API
 * 使用 SQLite 数据库存储，定期同步到文件系统
 *
 * 功能：
 * - GET  /api/data/:path        - 读取 JSON 文件
 * - POST /api/data/:path        - 写入 JSON 到数据库
 * - GET  /api/configs           - 列出所有配置
 * - GET  /api/sync              - 手动触发同步
 * - GET  /api/health            - 健康检查
 *
 * 部署：
 * 1. 安装依赖：npm install express cors better-sqlite3
 * 2. 启动服务：node server/api-server.js
 * 3. 默认端口：8081
 * 4. 或集成到现有服务器
 *
 * @requires
 * npm install express cors better-sqlite3
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// ==================== 配置 ====================

const CONFIG = {
  // API 端口
  PORT: process.env.PORT || 8081,

  // 数据库路径
  DB_PATH: path.join(__dirname, 'data', 'configs.db'),

  // 数据根目录（指向项目根目录的 public/data）
  DATA_DIR: path.join(__dirname, '..', 'public', 'data'),

  // CORS 配置
  CORS: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  },

  // 目录浏览配置
  DIRECTORY_BROWSING: true // 启用目录浏览
};
const DatabaseManager = require('./sqlite-db-manager');

// ==================== Express 应用 ====================

const app = express();

// CORS
app.use(cors(CONFIG.CORS));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 静态文件服务（启用目录浏览）
const serveIndex = require('serve-index');
const serveStatic = express.static(CONFIG.DATA_DIR, {
  index: false, // 不自动寻找 index.html
  setHeaders: (res, path) => {
    // 设置 JSON 文件的 Content-Type
    if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  }
});

app.use('/data', serveStatic);
app.use('/data', serveIndex(CONFIG.DATA_DIR, {
  icons: true,
  view: 'listing',
  filter: (filename, index) => {
    // 可以在这里添加过滤规则
    return true; // 显示所有文件
  }
}));

// ==================== 数据库管理器 ====================

let dbManager = null;

async function initDatabase() {
  try {
    dbManager = new DatabaseManager(CONFIG.DB_PATH, {
      dataDir: CONFIG.DATA_DIR,
      autoSync: true,
      syncInterval: 10000 // 10秒同步一次
    });

    await dbManager.init();
    console.log('✅ 数据库已就绪');

    // ⭐ 智能同步：只导入文件系统中有但数据库中没有的配置
    console.log('📥 检查文件系统中的新配置...');
    try {
      const syncResult = await dbManager.smartSyncFromFilesystem();

      if (syncResult.imported.length > 0) {
        console.log(`✅ 已导入 ${syncResult.imported.length} 个新配置:`);
        syncResult.imported.forEach(item => {
          console.log(`   - ${item.path} → ${item.tableName}`);
        });
      } else {
        console.log('ℹ️ 没有新的配置需要导入');
      }

      if (syncResult.skipped.length > 0) {
        console.log(`⏭️ 跳过 ${syncResult.skipped.length} 个已存在的配置`);
      }
    } catch (syncError) {
      console.error('⚠️ 智能同步出现问题:', syncError.message);
      // 不影响服务器启动，继续运行
    }

    console.log('🚀 API 服务器准备就绪');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

// ==================== API 路由 ====================

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API 服务器运行正常',
    timestamp: new Date().toISOString(),
    database: dbManager ? 'connected' : 'disconnected'
  });
});

/**
 * 读取 JSON 文件
 * GET /api/data/:path
 *
 * 示例：GET /api/data/gis/oblique_photography.json
 */
app.get('/api/data/*', (req, res) => {
  try {
    const relativePath = req.params[0]; // 获取通配符匹配的部分

    // 安全检查
    const cleanPath = relativePath.replace(/\.\./g, '');

    // 优先从数据库读取（最新数据）
    const data = dbManager.loadConfig(cleanPath);

    if (data !== null) {
      return res.json({
        success: true,
        source: 'database',
        data: data
      });
    }

    // 数据库中没有，尝试从文件读取
    const fs = require('fs');
    const filePath = path.join(CONFIG.DATA_DIR, cleanPath);

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileData = JSON.parse(content);

      res.json({
        success: true,
        source: 'filesystem',
        data: fileData
      });
    } catch (readError) {
      res.status(404).json({
        success: false,
        error: '配置文件不存在'
      });
    }
  } catch (error) {
    console.error('读取配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 写入 JSON 配置
 * POST /api/data/:path
 *
 * 示例：POST /api/data/gis/oblique_photography.json
 * Body: { data: [...] }
 */
app.post('/api/data/*', (req, res) => {
  try {
    const relativePath = req.params[0];

    // 安全检查
    const cleanPath = relativePath.replace(/\.\./g, '');

    // 验证路径扩展名
    if (!cleanPath.endsWith('.json')) {
      return res.status(400).json({
        success: false,
        error: '只允许 .json 文件'
      });
    }

    // 获取数据
    const { data } = req.body;

    if (data === undefined || data === null) {
      return res.status(400).json({
        success: false,
        error: '缺少数据字段'
      });
    }

    // 保存到数据库
    const result = dbManager.saveConfig(cleanPath, data);

    if (result.success) {
      res.json({
        success: true,
        message: '配置已保存',
        ...result
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('写入配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 列出所有配置
 * GET /api/configs
 */
app.get('/api/configs', (req, res) => {
  try {
    const configs = dbManager.listConfigs();

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('列出配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发同步
 * POST /api/sync
 * Body: { direction: 'to-file' | 'from-file' }
 */
app.post('/api/sync', async (req, res) => {
  try {
    const { direction = 'to-file' } = req.body;

    let result;

    if (direction === 'to-file') {
      // 数据库 → 文件系统
      result = await dbManager.syncToFilesystem();
    } else if (direction === 'from-file') {
      // 文件系统 → 数据库
      result = await dbManager.syncFromFilesystem();
    } else {
      return res.status(400).json({
        success: false,
        error: '无效的同步方向'
      });
    }

    res.json({
      success: true,
      message: '同步完成',
      result: result
    });
  } catch (error) {
    console.error('同步失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取统计信息
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = dbManager.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 错误处理 ====================

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API 不存在'
  });
});

// 错误中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// ==================== 启动服务器 ====================

async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动服务器
    app.listen(CONFIG.PORT, () => {
      console.log('====================================');
      console.log('🚀 API 服务器已启动');
      console.log('====================================');
      console.log(`📡 端口: ${CONFIG.PORT}`);
      console.log(`🌐 http://192.168.31.146:${CONFIG.PORT}`);
      console.log(`📁 数据目录: ${CONFIG.DATA_DIR}`);
      console.log(`💾 数据库: ${CONFIG.DB_PATH}`);
      console.log('');
      console.log('📝 API 端点:');
      console.log(`   GET  /api/data/:path       - 读取配置`);
      console.log(`   POST /api/data/:path       - 写入配置`);
      console.log(`   GET  /api/configs          - 配置列表`);
      console.log(`   POST /api/sync             - 手动同步`);
      console.log(`   GET  /api/stats            - 统计信息`);
      console.log(`   GET  /api/health           - 健康检查`);
      console.log('====================================');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

// 启动
startServer();

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n👋 服务器正在关闭...');

  if (dbManager) {
    dbManager.close();
  }

  process.exit(0);
});

module.exports = app;
