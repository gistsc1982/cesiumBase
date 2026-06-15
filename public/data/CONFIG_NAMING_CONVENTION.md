# 配置文件命名规范

## 概述
！！！注意只有全部小写英文字母和数字的配置会被写入sqlite配置数据库，其他作为普通数据或文件配置。





本目录中的 JSON 配置文件必须遵循特定的命名规范，以确保与数据库管理系统的兼容性。

---

## 命名规则

### 允许的字符

配置文件名**只允许**使用以下字符：

- ✅ **小写字母** (a-z)
- ✅ **数字** (0-9)
- ✅ **下划线** (_)

### 不允许的字符

- ❌ **大写字母** (A-Z)
- ❌ **连字符** (-)
- ❌ **空格** ( )
- ❌ **点号** (.) **除了 .json 扩展名**
- ❌ **特殊符号** (@, #, $, %, &, *, 等)

---

## 命名格式

### 文件名格式

```
[名称].json
```

### 目录路径格式

```
data/[目录1]/[目录2]/[名称].json
```

---

## 正确示例

```
✅ valid_name.json
✅ config_123.json
✅ user_settings.json
✅ building_model.json
✅ height_map.json
```

### 子目录示例

```
✅ gis/oblique_photography.json
✅ bim/building_model.json
✅ terrain/height_map.json
✅ config4user/user1/settings.json
```

---

## 错误示例

```
❌ ObliquePhotography.json          (包含大写字母)
❌ oblique-photography.json          (包含连字符)
❌ My Config.json                   (包含大写字母和空格)
❌ user_settings.config.json        (包含点号)
❌ test@123.json                    (包含特殊符号)
❌ 地图配置.json                    (包含中文字符)
```

---

## 转换规则

### 文件名到表名的转换

数据库使用表名来存储配置，转换规则如下：

```
文件路径                    →  数据库表名
gis/oblique_photography.json → gis_oblique_photography
config4user/user1/data.json  → config4user_user1_data
```

**转换逻辑**：
1. 移除 `.json` 扩展名
2. 将路径分隔符 `/` 替换为下划线 `_`
3. 转换为小写

---

## 为什么需要这个规范？

### 1. 避免命名冲突

**问题**：如果允许连字符和下划线，会导致冲突

```
gis/oblique-photography.json  → gis_oblique_photography
gis/oblique_photography.json → gis_oblique_photography  ⚠️ 冲突！
```

**解决**：只允许下划线，避免歧义

### 2. 跨平台兼容性

- Windows 和 Linux 系统对文件名大小写的处理不同
- 统一使用小写字母确保跨平台一致性

### 3. 数据库安全性

- 防止 SQL 注入
- 避免特殊字符导致的问题

---

## 如何重命名不符合规范的文件？

### 方法 1: 手动重命名

将文件名转换为符合规范的格式：

```
原文件名                               →  新文件名
ObliquePhotography.json               → oblique_photography.json
oblique-photography.json               → oblique_photography.json
functionPanels.config.json             → functionpanels.json
User Settings.json                     → user_settings.json
```

**转换规则**：
1. 转换为小写
2. 替换空格为下划线
3. 替换连字符为下划线
4. 移除点号（除了 .json）

### 方法 2: 使用自动化工具

在服务器目录运行检查脚本：

```bash
cd server
node check-files.js
```

查看需要重命名的文件，然后运行：

```bash
node rename-files.js
```

---

## 验证命名规范

### 检查脚本

使用正则表达式验证：

```javascript
const VALID_CONFIG_NAME_REGEX = /^[a-z0-9_]+\.json$/;

function validateFileName(fileName) {
  return VALID_CONFIG_NAME_REGEX.test(fileName);
}

// 测试
console.log(validateFileName('valid_name.json'));     // true
console.log(validateFileName('Invalid-Name.json'));   // false
```

---

## 目录结构示例

```
public/data/
├── gis/
│   ├── oblique_photography.json
│   ├── vector_map.json
│   └── raster_data.json
├── bim/
│   ├── building_model.json
│   └── ifc_data.json
├── terrain/
│   ├── height_map.json
│   └── elevation.json
├── config4user/
│   └── user1/
│       └── settings.json
└── config.json
```

---

## API 访问

### 读取配置

```bash
GET /api/data/gis/oblique_photography.json
```

### 写入配置

```bash
POST /api/data/gis/oblique_photography.json
Content-Type: application/json

{
  "data": [...]
}
```

### 列出所有配置

```bash
GET /api/configs
```

---

## 常见问题

### Q: 我已经有不符合规范的文件，怎么办？

**A**: 系统会自动跳过不符合规范的文件，不会导入到数据库。建议重命名文件以符合规范。

### Q: 可以使用中文文件名吗？

**A**: 不建议。虽然文件系统可能支持，但在数据库和 Web 环境中可能引起问题。请使用拼音或英文。

### Q: 如何批量重命名文件？

**A**: 可以使用脚本或手动重命名。确保：
1. 转换为小写
2. 用下划线替换空格和连字符
3. 移除特殊字符

### Q: 目录名也有要求吗？

**A**: 是的。目录名也只允许小写字母、数字和下划线。

---

## 版本历史

- **v1.0** (2026-06-13) - 初始版本，建立命名规范
- 与 SQLite 数据库管理系统集成
- 支持自动同步和验证

---

## 支持

如有问题，请查看：
- `server/sqlite-db-manager.js` - 数据库管理器实现
- `server/api-server.js` - API 服务器实现
- `docs/smart-sync-feature.md` - 智能同步功能文档
