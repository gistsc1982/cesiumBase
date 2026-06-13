# Cesium 配置文件数据服务器

基于 SQLite + Express 的配置文件管理系统，支持通过 HTTP API 进行读写操作，自动同步到 FTP 文件系统。

## 架构说明

```
┌─────────────┐     HTTP GET      ┌──────────────┐
│   前端应用   │ ←───────────────→ │  静态文件服务  │
│  (Vue.js)   │                   │  (data/ 目录) │
└─────────────┘                   └──────────────┘
       │                                 │
       │ HTTP POST                      │
       ↓                                 ↓
┌─────────────┐     自动同步       ┌──────────────┐
│  Express    │ ←──────────────→ │  SQLite 数据库 │
│  API 服务    │                   │  (configs.db) │
└─────────────┘                   └──────────────┘
                                          │
                                          │ FTP 同步
                                          ↓
                                  ┌──────────────┐
                                  │ FTP 文件系统  │
                                  │ (读写权限)    │
                                  └──────────────┘
```

## 功能特性

### 前端功能
- ✅ 通过 HTTP 读取配置文件
- ✅ 通过 HTTP API 写入配置
- ✅ 本地文件导出/导入（备用）
- ✅ 数据验证和错误处理
- ✅ 支持多种配置文件类型

### 后端功能
- ✅ SQLite 数据库存储
- ✅ 自动同步到文件系统
- ✅ RESTful API 设计
- ✅ CORS 跨域支持
- ✅ 事务安全保证

### 同步机制
- ✅ 数据库 → 文件系统（自动，10秒间隔）
- ✅ 文件系统 → 数据库（手动/自动）
- ✅ FTP 目录自动映射表名

## 部署步骤

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置 FTP 目录权限

确保 FTP 服务器配置：
- 匿名用户对 `/data` 目录有读写权限
- FTP 目录与 HTTP 访问目录保持一致

### 3. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器启动后：
- API 服务: `http://192.168.31.146:8081`
- 静态文件: `http://192.168.31.146:8080/data`

### 4. 初始化数据库（可选）

```bash
# 创建数据库文件
npm run init-db

# 从文件系统导入现有配置
npm run import

# 查看统计信息
npm run stats
```

## API 文档

### 读取配置

**请求**
```
GET /api/data/:path
```

**示例**
```http
GET /api/data/gis/oblique-photography.json
```

**响应**
```json
{
  "success": true,
  "source": "database",
  "data": [...]
}
```

### 写入配置

**请求**
```
POST /api/data/:path
Content-Type: application/json

{
  "data": [...]
}
```

**示例**
```http
POST /api/data/gis/oblique-photography.json
Content-Type: application/json

{
  "data": [
    {
      "id": "bridge3d",
      "name": "桥梁3D",
      "url": "https://example.com/tileset.json"
    }
  ]
}
```

**响应**
```json
{
  "success": true,
  "message": "配置已保存",
  "action": "create",
  "tableName": "gis_oblique_photography",
  "version": 1
}
```

### 其他 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/configs` | 列出所有配置 |
| GET | `/api/stats` | 数据库统计信息 |
| POST | `/api/sync` | 手动触发同步 |
| GET | `/api/health` | 健康检查 |

## 前端使用

### 配置 DataManager

```javascript
import { dataManager } from './utils/DataManager.js';

// 设置服务器配置
dataManager.setServerConfig({
  baseURL: 'http://192.168.31.146',
  apiPort: 8081
});

// 从服务器加载配置
const data = await dataManager.loadFromServer('oblique-photography');

// 保存配置到服务器
await dataManager.uploadToServer('oblique-photography', data);
```

### ObliquePhotographyPanel 集成

面板已集成导出/导入功能：

1. **导出按钮**：将配置保存到服务器数据库
2. **导入按钮**：从服务器加载配置
3. **自动同步**：服务器自动将数据库同步到文件系统

## 数据库结构

### 表名映射规则

FTP 文件路径 → 数据库表名

| 文件路径 | 表名 |
|---------|------|
| `gis/oblique-photography.json` | `gis_oblique_photography` |
| `models/city-model.json` | `models_city_model` |

### 表结构

每个配置表都包含：

```sql
CREATE TABLE {table_name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  json_data TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## FTP 配置

### vsftpd 配置示例

```ini
# 允许匿名访问
anonymous_enable=YES

# 匿名用户根目录
anon_root=/path/to/public

# 允许匿名写入
anon_upload_enable=YES
anon_mkdir_write_enable=YES

# 文件权限
anon_umask=022

# 目录权限
file_open_mode=0666
dir_message_enable=YES
```

### IIS FTP 配置

1. 创建 FTP 站点，指向 `public/data` 目录
2. 启用匿名身份验证
3. 授权读写权限

## 故障排查

### API 无法访问

1. 检查防火墙设置
2. 确认端口 8081 未被占用
3. 验证 CORS 配置

### 数据库锁定

```bash
# 查看进程
lsof data/configs.db

# 强制关闭
kill -9 {PID}
```

### 同步失败

1. 检查文件系统权限
2. 确认目录路径正确
3. 查看服务器日志

## 安全建议

### 生产环境

1. **限制 CORS 来源**
   ```javascript
   CORS: {
     origin: 'https://yourdomain.com'
   }
   ```

2. **添加身份验证**
   ```javascript
   // 在 api-server.js 添加
   app.use('/api', authMiddleware);
   ```

3. **HTTPS 加密**
   使用 SSL 证书加密数据传输

4. **定期备份**
   ```bash
   # 备份数据库
   cp data/configs.db data/backups/configs-$(date +%Y%m%d).db
   ```

## 许可证

MIT
