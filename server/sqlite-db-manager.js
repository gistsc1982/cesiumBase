/**
 * SQLite 数据库 JSON 文件管理器
 *
 * 使用 SQLite 数据库存储和同步 JSON 配置文件
 * 数据库表名映射 FTP 目录结构
 * 无需额外开放端口，通过现有 HTTP 服务器处理
 *
 * 架构：
 * - 前端 HTTP GET: 读取 JSON 文件（静态文件服务）
 * - 前端 HTTP POST: 写入 SQLite 数据库
 * - 同步机制: 数据库 ↔ FTP 文件系统
 *
 * 功能：
 * - 数据库表管理（对应目录结构）
 * - JSON CRUD 操作
 * - 文件同步（导出到 FTP 目录）
 * - 事务支持
 *
 * @requires
 * npm install better-sqlite3
 *
 * @example
 * const dbManager = new DatabaseManager('./data/configs.db');
 * await dbManager.init();
 * await dbManager.saveConfig('gis/oblique_photography.json', data);
 * const data = await dbManager.loadConfig('gis/oblique_photography.json');
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');

/**
 * 命名规范：配置文件名只允许小写字母、数字、下划线
 * 不允许连字符、空格、点号（除了 .json 扩展名）
 * @constant {RegExp}
 */
const VALID_CONFIG_NAME_REGEX = /^[a-z0-9_]+\.json$/;

/**
 * 验证配置文件名是否符合命名规范
 * @param {string} fileName - 文件名（不含路径）
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateConfigFileName(fileName) {
  // 检查是否以 .json 结尾
  if (!fileName.endsWith('.json')) {
    return { valid: false, reason: '文件名必须以 .json 结尾' };
  }

  // 检查命名规范
  if (!VALID_CONFIG_NAME_REGEX.test(fileName)) {
    return {
      valid: false,
      reason: '文件名只能包含小写字母、数字、下划线，不允许连字符、空格、点号'
    };
  }

  return { valid: true };
}

/**
 * 验证配置文件路径是否符合命名规范
 * @param {string} relativePath - 相对路径（如 gis/oblique_photography.json）
 * @returns {Object} { valid: boolean, reason: string, fileName: string }
 */
function validateConfigPath(relativePath) {
  // 规范化路径分隔符
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // 分离路径和文件名
  const parts = normalizedPath.split('/');
  const fileName = parts[parts.length - 1];

  // 验证文件名
  const validation = validateConfigFileName(fileName);
  if (!validation.valid) {
    return {
      valid: false,
      reason: `文件名 "${fileName}" 不符合命名规范：${validation.reason}`,
      fileName: fileName
    };
  }

  // 检查路径中的目录名（只允许字母数字下划线）
  for (let i = 0; i < parts.length - 1; i++) {
    const dirName = parts[i];
    if (!/^[a-z0-9_]+$/.test(dirName)) {
      return {
        valid: false,
        reason: `目录名 "${dirName}" 只能包含小写字母、数字、下划线`,
        fileName: fileName
      };
    }
  }

  return {
    valid: true,
    fileName: fileName,
    normalizedPath: normalizedPath
  };
}

class DatabaseManager {
  /**
   * @param {string} dbPath - 数据库文件路径
   * @param {Object} options - 配置选项
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.db = null;
    this.options = {
      // FTP/HTTP 数据根目录
      dataDir: options.dataDir || path.join(__dirname, 'public', 'data'),
      // 是否自动同步到文件
      autoSync: options.autoSync !== false,
      // 同步间隔（毫秒）
      syncInterval: options.syncInterval || 5000
    };

    this.syncTimer = null;
  }

  /**
   * 初始化数据库
   */
  async init() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // 打开数据库连接
      this.db = new Database(this.dbPath);

      // 启用外键约束
      this.db.pragma('foreign_keys = ON');

      // 创建元数据表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS _metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 初始化版本号
      const version = this.db.prepare('SELECT value FROM _metadata WHERE key = ?').get('version');
      if (!version) {
        this.db.prepare('INSERT INTO _metadata (key, value) VALUES (?, ?)').run('version', '1.0.0');
      }

      console.log(`✅ 数据库已初始化: ${this.dbPath}`);

      // 启动自动同步
      if (this.options.autoSync) {
        this.startAutoSync();
      }

      return true;
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('📴 数据库已关闭');
    }
  }

  /**
   * 将路径转换为表名
   * 命名规范：只允许小写字母、数字、下划线
   * 例如: gis/oblique_photography.json → gis_oblique_photography
   */
  pathToTableName(relativePath) {
    if (!relativePath) {
      console.warn('⚠️ pathToTableName: relativePath 为空或 undefined');
      return '';
    }

    try {
      // 规范化路径分隔符
      const normalized = relativePath.replace(/\\/g, '/');

      return normalized
        .replace(/\.json$/i, '')           // 移除 .json 扩展名
        .replace(/\//g, '_')               // 替换 / 为 _
        .toLowerCase();
    } catch (error) {
      console.error(`❌ pathToTableName 转换失败: ${relativePath}`, error.message);
      return '';
    }
  }

  /**
   * 将表名转换回文件路径
   * 命名规范：只允许小写字母、数字、下划线
   * 例如: gis_oblique_photography → gis/oblique_photography.json
   */
  tableNameToPath(tableName) {
    // 反向转换：下划线 → 目录分隔符或连字符
    // 策略：根据配置ID的常见模式进行转换

    // 已知的配置文件映射（特殊情况优先处理）
    const knownMappings = {
      'gis_oblique_photography': 'gis/oblique_photography.json',
      // 可以添加更多映射
    };

    if (knownMappings[tableName]) {
      return knownMappings[tableName];
    }

    // 通用转换策略
    const parts = tableName.split('_');

    // 尝试不同的转换策略
    if (parts.length === 3 && parts[0] === 'gis' && parts[1] === 'oblique' && parts[2] === 'photography') {
      return 'gis/oblique_photography.json';
    }

    // 默认：将第一个下划线转为 /，其余保持
    if (parts.length > 1) {
      const first = parts[0];
      const rest = parts.slice(1).join('_');
      return `${first}/${rest}.json`;
    }

    // 回退：所有下划线转为 /
    return `${tableName.replace(/_/g, '/')}.json`;
  }

  /**
   * 确保配置表存在
   */
  ensureTable(tableName) {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        json_data TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER IF NOT EXISTS ${tableName}_update_timestamp
      AFTER UPDATE ON ${tableName}
      FOR EACH ROW
      BEGIN
        UPDATE ${tableName} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `;

    this.db.exec(sql);
  }

  /**
   * 保存配置到数据库
   * @param {string} relativePath - 相对路径（如 gis/oblique_photography.json）
   * @param {Array|Object} data - JSON 数据
   * @returns {Promise<Object>} 保存结果
   */
  saveConfig(relativePath, data) {
    try {
      // 验证文件路径符合命名规范
      const validation = validateConfigPath(relativePath);
      if (!validation.valid) {
        console.error(`❌ 路径验证失败: ${relativePath}`);
        console.error(`   原因: ${validation.reason}`);
        return {
          success: false,
          error: `配置文件路径不符合命名规范：${validation.reason}`,
          reason: validation.reason
        };
      }

      const tableName = this.pathToTableName(relativePath);

      // 确保表存在
      this.ensureTable(tableName);

      // 转换为 JSON 字符串
      const jsonData = JSON.stringify(data, null, 2);

      // 使用事务
      const save = this.db.transaction(() => {
        // 检查是否已存在记录
        const existing = this.db.prepare(`SELECT id, version FROM ${tableName} WHERE id = 1`).get();

        if (existing) {
          // 更新现有记录
          const stmt = this.db.prepare(`
            UPDATE ${tableName}
            SET json_data = ?, version = version + 1
            WHERE id = 1
          `);
          stmt.run(jsonData);

          return {
            action: 'update',
            tableName: tableName,
            version: existing.version + 1
          };
        } else {
          // 插入新记录
          const stmt = this.db.prepare(`
            INSERT INTO ${tableName} (json_data)
            VALUES (?)
          `);
          const info = stmt.run(jsonData);

          return {
            action: 'create',
            tableName: tableName,
            id: info.lastInsertRowid,
            version: 1
          };
        }
      });

      const result = save();

      console.log(`💾 配置已保存: ${relativePath} → ${tableName}`);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error(`❌ 保存配置失败: ${relativePath}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 从数据库加载配置
   * @param {string} relativePath - 相对路径
   * @returns {Object|null} JSON 数据
   */
  loadConfig(relativePath) {
    try {
      // 验证参数
      if (!relativePath) {
        console.warn('⚠️ loadConfig: relativePath 为空');
        return null;
      }

      const tableName = this.pathToTableName(relativePath);

      // 如果转换失败，返回 null
      if (!tableName) {
        console.warn(`⚠️ loadConfig: 无法转换路径 "${relativePath}" 为表名`);
        return null;
      }

      // 检查表是否存在
      const tableExists = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `).get(tableName);

      if (!tableExists) {
        console.log(`⚠️ 表不存在: ${tableName}`);
        return null;
      }

      // 查询数据
      const row = this.db.prepare(`SELECT json_data FROM ${tableName} WHERE id = 1`).get();

      if (!row) {
        console.log(`⚠️ 无数据: ${tableName}`);
        return null;
      }

      return JSON.parse(row.json_data);
    } catch (error) {
      console.error(`❌ 加载配置失败: ${relativePath}`, error);
      return null;
    }
  }

  /**
   * 删除配置
   * @param {string} relativePath - 相对路径
   */
  deleteConfig(relativePath) {
    try {
      const tableName = this.pathToTableName(relativePath);

      this.db.prepare(`DELETE FROM ${tableName} WHERE id = 1`).run();

      console.log(`🗑️ 配置已删除: ${relativePath}`);

      return { success: true };
    } catch (error) {
      console.error(`❌ 删除配置失败: ${relativePath}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取所有配置列表
   * 返回格式与前端期望的兼容：
   * {
   *   fileName: "oblique_photography.json",
   *   filePath: "gis/oblique_photography.json",
   *   fileSize: 1234,
   *   modifiedTime: "2024-01-01T00:00:00Z"
   * }
   */
  listConfigs() {
    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all();

      const configs = [];

      for (const table of tables) {
        // 获取表数据和更新时间
        const row = this.db.prepare(`
          SELECT json_data, updated_at
          FROM ${table.name}
          WHERE id = 1
        `).get();

        if (row) {
          try {
            const data = JSON.parse(row.json_data);
            const filePath = this.tableNameToPath(table.name);
            const fileName = path.basename(filePath);

            configs.push({
              fileName: fileName,
              filePath: filePath,
              fileSize: row.json_data.length,
              modifiedTime: row.updated_at || new Date().toISOString(),
              itemCount: Array.isArray(data) ? data.length : Object.keys(data).length,
              dataSize: row.json_data.length
            });
          } catch (parseError) {
            console.warn(`无法解析表数据: ${table.name}`);
          }
        }
      }

      return configs;
    } catch (error) {
      console.error('❌ 列出配置失败:', error);
      return [];
    }
  }

  /**
   * 同步数据库到文件系统（导出）
   * 将数据库中的配置写入 FTP 目录
   */
  async syncToFilesystem() {
    try {
      const configs = this.listConfigs();
      const results = [];

      for (const config of configs) {
        try {
          // 使用正确的属性名：config.filePath
          const configPath = config.filePath || config.path;
          if (!configPath) {
            console.warn(`⚠️ 跳过无效配置: ${JSON.stringify(config)}`);
            continue;
          }

          const data = this.loadConfig(configPath);
          if (!data) {
            console.warn(`⚠️ 无法加载配置: ${configPath}`);
            continue;
          }

          const filePath = path.join(this.options.dataDir, configPath);
          const dir = path.dirname(filePath);

          // 确保目录存在
          await fs.mkdir(dir, { recursive: true });

          // 写入文件（只在内容变化时才写入）
          const jsonData = JSON.stringify(data, null, 2);

          // 检查文件是否已存在且内容相同
          let needsWrite = true;
          try {
            const existingContent = await fs.readFile(filePath, 'utf8');
            if (existingContent === jsonData) {
              needsWrite = false;
              console.log(`⏭️ 跳过（内容未变）: ${configPath}`);
            }
          } catch (readError) {
            // 文件不存在，需要写入
            needsWrite = true;
          }

          if (needsWrite) {
            await fs.writeFile(filePath, jsonData, 'utf8');
            console.log(`📤 已同步: ${configPath}`);
          }

          results.push({
            path: configPath,
            success: true
          });

          console.log(`📤 已同步: ${configPath}`);
        } catch (error) {
          results.push({
            path: config.filePath || config.path || 'unknown',
            success: false,
            error: error.message
          });
          console.error(`❌ 同步失败: ${config.fileName}`, error);
        }
      }

      return {
        total: configs.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results
      };
    } catch (error) {
      console.error('❌ 同步失败:', error);
      throw error;
    }
  }

  /**
   * 从文件系统同步到数据库（导入）
   * 将 FTP 目录中的文件导入数据库
   * 只导入符合命名规范的文件
   */
  async syncFromFilesystem() {
    try {
      const results = [];
      const skipped = [];

      // ⭐ 保存 this 引用，避免在嵌套函数中丢失上下文
      const self = this;

      // 递归扫描 data 目录
      async function scanDir(dir, relativePath = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // 使用 / 作为路径分隔符（跨平台兼容）
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await scanDir(fullPath, relPath);
          } else if (entry.isFile() && path.extname(entry.name) === '.json') {
            // 验证文件名符合命名规范
            const validation = validateConfigPath(relPath);

            if (!validation.valid) {
              skipped.push({
                path: relPath,
                reason: validation.reason
              });
              console.warn(`⚠️ 跳过不符合规范的文件: ${relPath}`);
              console.warn(`   原因: ${validation.reason}`);
              continue;
            }

            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const data = JSON.parse(content);

              // ⭐ 使用 self 代替 this
              self.saveConfig(relPath, data);

              results.push({
                path: relPath,
                success: true
              });

              console.log(`📥 已导入: ${relPath}`);
            } catch (error) {
              results.push({
                path: relPath,
                success: false,
                error: error.message
              });
              console.error(`❌ 导入失败: ${relPath}`, error);
            }
          }
        }
      }

      await scanDir(this.options.dataDir);

      // 输出跳过文件的汇总
      if (skipped.length > 0) {
        console.log(`\n⚠️ 跳过 ${skipped.length} 个不符合命名规范的文件`);
        skipped.forEach(item => {
          console.log(`   - ${item.path}: ${item.reason}`);
        });
        console.log('提示: 请重命名文件以符合命名规范（只允许小写字母、数字、下划线）');
      }

      return {
        imported: results,
        skipped: skipped,
        total: results.length + skipped.length
      };
    } catch (error) {
      console.error('❌ 同步失败:', error);
      throw error;
    }
  }

  /**
   * 启动自动同步
   */
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncToFilesystem().catch(error => {
        console.error('自动同步失败:', error);
      });
    }, this.options.syncInterval);

    console.log(`🔄 自动同步已启动（间隔: ${this.options.syncInterval}ms）`);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('⏸️ 自动同步已停止');
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE '\\__%' ESCAPE '\\'
      `).all();

      const stats = {
        tableCount: tables.length,
        tables: [],
        totalSize: 0
      };

      for (const table of tables) {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        const size = this.db.prepare(`SELECT SUM(LENGTH(json_data)) as size FROM ${table.name}`).get();

        stats.tables.push({
          name: table.name,
          recordCount: count.count,
          dataSize: size.size || 0
        });

        stats.totalSize += (size.size || 0);
      }

      stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);

      return stats;
    } catch (error) {
      console.error('❌ 获取统计失败:', error);
      return null;
    }
  }

  /**
   * 智能同步：只导入文件系统中有但数据库中没有的配置
   * 不会覆盖已存在的数据库表
   */
  async smartSyncFromFilesystem() {
    try {
      const fs = require('fs').promises;
      const results = {
        imported: [],
        skipped: [],
        failed: []
      };

      // 获取数据库中已存在的表
      const existingTables = new Set();
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%'
      `).all();
      tables.forEach(t => existingTables.add(t.name));

      console.log(`📊 数据库中已有的表: ${existingTables.size} 个`);

      // ⭐ 保存 this 引用，避免在嵌套函数中丢失上下文
      const self = this;

      // 递归扫描 data 目录
      async function scanDir(dir, relativePath = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // 使用 / 作为路径分隔符（跨平台兼容）
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            await scanDir(fullPath, relPath);
          } else if (entry.isFile() && (entry.name.endsWith('.json'))) {
            // 检查文件名是否符合命名规范
            const fileName = entry.name;
            const nameWithoutExt = fileName.replace(/\.json$/i, '');

            // 命名规范：只允许小写字母、数字、下划线
            if (!/^[a-z0-9_]+$/.test(nameWithoutExt)) {
              results.skipped.push({
                path: relPath,
                fileName: fileName,
                reason: '文件名不符合命名规范'
              });
              continue;
            }

            // 计算对应的表名
            const tableName = self.pathToTableName(relPath);

            // 检查表是否已存在
            if (existingTables.has(tableName)) {
              results.skipped.push({
                path: relPath,
                fileName: fileName,
                reason: '数据库表已存在'
              });
              console.log(`⏭️ 跳过: ${relPath} (表已存在)`);
              continue;
            }

            // 表不存在，导入文件
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const data = JSON.parse(content);

              self.saveConfig(relPath, data);

              results.imported.push({
                path: relPath,
                tableName: tableName
              });

              console.log(`📥 已导入: ${relPath} → ${tableName}`);
            } catch (error) {
              results.failed.push({
                path: relPath,
                fileName: fileName,
                error: error.message
              });
              console.error(`❌ 导入失败: ${relPath}`, error.message);
            }
          }
        }
      }

      await scanDir(this.options.dataDir);

      console.log(`\n📊 智能同步完成:`);
      console.log(`  ✅ 新导入: ${results.imported.length} 个`);
      console.log(`  ⏭️ 跳过: ${results.skipped.length} 个`);
      console.log(`  ❌ 失败: ${results.failed.length} 个`);

      return results;
    } catch (error) {
      console.error('❌ 智能同步失败:', error);
      throw error;
    }
  }
}

module.exports = DatabaseManager;

// ==================== CLI 使用 ====================

if (require.main === module) {
  const manager = new DatabaseManager('./data/configs.db');

  (async () => {
    try {
      await manager.init();

      // 命令行操作
      const command = process.argv[2];
      const arg = process.argv[3];

      switch (command) {
        case 'init':
          console.log('初始化数据库');
          break;

        case 'import':
          console.log('从文件系统导入...');
          await manager.syncFromFilesystem();
          break;

        case 'export':
          console.log('导出到文件系统...');
          const result = await manager.syncToFilesystem();
          console.log(result);
          break;

        case 'stats':
          console.log('数据库统计:');
          console.log(manager.getStats());
          break;

        case 'list':
          console.log('配置列表:');
          console.log(manager.listConfigs());
          break;

        default:
          console.log('用法:');
          console.log('  node sqlite-db-manager.js init        - 初始化数据库');
          console.log('  node sqlite-db-manager.js import     - 从文件导入');
          console.log('  node sqlite-db-manager.js export     - 导出到文件');
          console.log('  node sqlite-db-manager.js stats      - 统计信息');
          console.log('  node sqlite-db-manager.js list       - 配置列表');
      }

      manager.close();
    } catch (error) {
      console.error('错误:', error);
      process.exit(1);
    }
  })();
}
