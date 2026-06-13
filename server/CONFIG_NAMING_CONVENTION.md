# 配置文件命名规范与同步完成报告

## 执行日期
2026-06-13

## 概述
成功实现了 `configs.db` 数据库的同步，并建立了配置文件的命名规范。

---

## 一、命名规范

### 规则
配置文件名**只允许**以下字符：
- ✅ 小写字母 (a-z)
- ✅ 数字 (0-9)
- ✅ 下划线 (_)

**不允许**：
- ❌ 连字符 (-)
- ❌ 空格
- ❌ 点号 (除了 .json 扩展名)
- ❌ 大写字母
- ❌ 特殊符号

### 示例
```
✅ gis/oblique_photography.json
✅ bim/building_model.json
✅ terrain/height_map.json
✅ config4user/user1/settings.json

❌ gis/oblique-photography.json  (含连字符)
❌ config4user/user1/functionPanels.config.json  (含大写和点号)
```

---

## 二、已执行的更改

### 1. 文件重命名
| 原文件名 | 新文件名 |
|---------|---------|
| `gis/oblique-photography.json` | `gis/oblique_photography.json` |
| `config4user/user1/functionPanels.config.json` | `config4user/user1/functionpanels.json` |

### 2. 代码更新
更新的文件：
- `src/components/functions/ObliquePhotographyPanel.vue` - 更新 JSON 路径
- `src/utils/DataManager.js` - 更新配置定义
- `server/sqlite-db-manager.js` - 添加验证逻辑，简化转换函数
- `server/api-server.js` - 更新文档示例

### 3. 数据库同步结果
成功创建以下表：
- `gis_oblique_photography` - 包含 2 条倾斜摄影配置
- `config4user_user1_functionpanels` - 包含功能面板配置

清理的旧表：
- `config4useruser1functionpanels` ❌
- `config4useruser1functionpanelsconfig` ❌
- `gisoblique_photography` ❌

---

## 三、路径到表名的转换

### 转换规则
```
文件路径                    →  表名
gis/oblique_photography.json → gis_oblique_photography
config4user/user1/data.json → config4user_user1_data
```

**转换逻辑：**
1. 移除 `.json` 扩展名
2. 将路径分隔符 `/` 替换为下划线 `_`
3. 转换为小写

### 为什么需要这个规范？
原来的逻辑将连字符和下划线都转换为下划线，导致冲突：
```
gis/oblique-photography.json  → gis_oblique_photography
gis/oblique_photography.json → gis_oblique_photography  ⚠️ 冲突！
```

新规范避免了这个问题。

---

## 四、数据库管理器验证

### 添加的验证逻辑
`sqlite-db-manager.js` 现在包含：

1. **文件名验证** - `validateConfigFileName(fileName)`
   - 检查是否符合命名规范

2. **路径验证** - `validateConfigPath(relativePath)`
   - 验证完整路径（包括目录名）
   - 返回详细的错误信息

3. **保存时验证** - `saveConfig()` 方法
   - 在保存前验证路径
   - 不符合规范的文件会被拒绝

4. **同步时过滤** - `syncFromFilesystem()` 方法
   - 跳过不符合规范的文件
   - 记录警告信息

---

## 五、如何使用

### 通过 API 保存配置
```bash
# 保存配置到数据库
curl -X POST http://192.168.31.146:8081/api/data/gis/oblique_photography.json \
  -H "Content-Type: application/json" \
  -d '{"data": [...]}'

# 读取配置（优先从数据库读取）
curl http://192.168.31.146:8081/api/data/gis/oblique_photography.json
```

### 通过命令行同步
```bash
cd server

# 从文件系统同步到数据库
node execute-sync.js

# 检查数据库内容
node check-db.js

# 清理旧表
node cleanup-db.js
```

---

## 六、重要提示

1. **文件命名** - 创建新的配置文件时，请遵循命名规范
2. **API 服务器** - 确保端口 8081 的 API 服务器正在运行
3. **自动同步** - 数据库会每 10 秒自动同步到文件系统
4. **冲突避免** - 使用下划线而不是连字符作为单词分隔符

---

## 七、工具脚本

以下脚本可用于维护：

| 脚本 | 用途 |
|-----|------|
| `check-files.js` | 检查文件命名规范 |
| `rename-files.js` | 重命名不符合规范的文件 |
| `execute-sync.js` | 执行文件系统到数据库的同步 |
| `check-db.js` | 检查数据库内容 |
| `cleanup-db.js` | 清理数据库中的旧表 |

---

## 八、状态

✅ **同步完成**
✅ **验证逻辑已添加**
✅ **旧数据已清理**
✅ **命名规范已建立**

数据库 `configs.db` 现在可以正常使用，导入配置功能已经同步完成。
