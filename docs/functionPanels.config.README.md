# 功能面板配置说明

## 📋 概述

`functionPanels.config.json` 配置文件可以控制各个功能面板的加载和默认显示状态。

---

## 🎯 配置项说明

### 面板配置字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | ✅ | - | 组件名称（必须与组件的 name 属性一致）|
| `file` | string | ✅ | - | .vue 文件名 |
| `title` | string | ✅ | - | 面板标题 |
| `description` | string | ❌ | - | 面板描述 |
| `enabled` | boolean | ❌ | `true` | 是否启用（可加载）|
| `visible` | boolean | ❌ | `false` | 是否默认可见（自动显示）|
| `icon` | string | ❌ | `⚙️` | 面板图标 |
| `category` | string | ❌ | `tools` | 面板分类 |
| `permissions` | array | ❌ | `[]` | 权限配置（预留）|

---

## 🔧 配置示例

### 示例 1: 基础配置（面板默认隐藏）

```json
{
  "name": "TestPanel",
  "file": "TestPanel.vue",
  "title": "测试面板",
  "description": "测试自动加载功能的面板",
  "enabled": true,
  "visible": false,
  "icon": "🧪",
  "category": "test"
}
```

**效果：**
- ✅ 面板可以被加载
- ❌ 面板不会自动显示
- 👆 用户需要手动点击才能看到

---

### 示例 2: 面板默认可见

```json
{
  "name": "ToolPanel",
  "file": "ToolPanel.vue",
  "title": "工具面板",
  "enabled": true,
  "visible": true,
  "icon": "🔧",
  "category": "tools"
}
```

**效果：**
- ✅ 面板可以被加载
- ✅ 面板会自动显示
- 👁️ 用户打开页面就能看到

---

### 示例 3: 禁用面板

```json
{
  "name": "DeprecatedPanel",
  "file": "DeprecatedPanel.vue",
  "title": "已弃用的面板",
  "enabled": false,
  "visible": false
}
```

**效果：**
- ❌ 面板不会被加载
- ❌ 面板不会显示
- 🚫 用户无法访问此面板

---

## 📖 字段详解

### enabled vs visible

| 字段 | 作用 | 范围 |
|------|------|------|
| `enabled` | 控制面板是否可以被加载 | 全局（影响所有用户）|
| `visible` | 控制面板是否默认显示 | UI 层面（用户可以手动打开）|

**组合效果：**

| enabled | visible | 效果 |
|---------|---------|------|
| `true` | `true` | ✅ 面板加载并自动显示 |
| `true` | `false` | ✅ 面板加载但需手动打开 |
| `false` | `true` | ❌ 面板不加载（无法显示）|
| `false` | `false` | ❌ 面板不加载（无法显示）|

---

## 🛠️ 使用方式

### 方式一：编辑 JSON 文件

1. 打开 `cesiumBase/src/components/functions/functionPanels.config.json`
2. 修改对应面板的 `visible` 字段
3. 保存文件
4. 刷新页面生效

### 方式二：使用配置管理器（代码）

```javascript
import configManager from './functions/FunctionPanelsConfigManager.js';

// 检查面板是否可见
const isVisible = configManager.isPanelVisible('TestPanel');

// 显示面板
configManager.showPanel('TestPanel');

// 隐藏面板
configManager.hidePanel('TestPanel');

// 获取所有可见面板
const visiblePanels = configManager.getVisiblePanels();

// 获取所有隐藏面板
const hiddenPanels = configManager.getHiddenPanels();
```

### 方式三：浏览器控制台调试

```javascript
// 访问配置管理器
window.__functionPanelsConfigManager__

// 检查可见性
window.__functionPanelsConfigManager__.isPanelVisible('TestPanel')

// 显示面板（仅修改内存，不持久化）
window.__functionPanelsConfigManager__.showPanel('TestPanel')

// 查看统计信息
window.__functionPanelsConfigManager__.getStats()
```

---

## 🎮 实际应用场景

### 场景一：开发测试

**需求：** 开发时让测试面板默认显示，生产环境隐藏

```json
{
  "name": "TestPanel",
  "visible": true  // 开发时设为 true
}
```

### 场景二：常用工具

**需求：** 常用工具面板默认显示，罕见工具隐藏

```json
{
  "name": "CommonTool",
  "visible": true
},
{
  "name": "RareTool",
  "visible": false
}
```

### 场景三：渐进式功能

**需求：** 新功能默认隐藏，用户熟悉后再显示

```json
{
  "name": "AdvancedFeature",
  "visible": false
}
```

---

## ⚠️ 注意事项

1. **visible 需要 enabled 为 true**
   - 如果 `enabled: false`，面板不会被加载，`visible` 设置无效

2. **修改后需刷新页面**
   - JSON 配置修改后需要刷新浏览器才能生效

3. **visible 不影响已打开的面板**
   - 如果面板已经打开，修改配置不会关闭它
   - 配置仅影响初始加载状态

4. **运行时修改不持久化**
   - 通过代码或控制台修改的 visible 状态不会保存到文件
   - 需要直接编辑 JSON 文件才能持久化

---

## 🔄 动态控制（运行时）

如果需要在运行时控制面板显示/隐藏，可以使用 CesiumMain 提供的方法：

```javascript
// 获取 CesiumMain 实例（假设已暴露到全局）
const cesiumMain = window.__cesiumMainInstance__;

// 显示面板
cesiumMain.setPanelVisible('TestPanel', true);

// 隐藏面板
cesiumMain.setPanelVisible('TestPanel', false);

// 切换面板
cesiumMain.togglePanel('TestPanel');

// 检查状态
const isVisible = cesiumMain.registeredPanels['TestPanel']?.visible;
```

---

## 📊 配置统计

使用配置管理器查看统计信息：

```javascript
const stats = window.__functionPanelsConfigManager__.getStats();

console.log(`
  总面板数: ${stats.total}
  已启用: ${stats.enabled}
  已禁用: ${stats.disabled}
  可见: ${stats.visible}
  隐藏: ${stats.hidden}
  分类数: ${stats.categories}
`);
```

---

## 💡 最佳实践

1. **默认隐藏所有面板**
   - 保持 `visible: false` 作为默认值
   - 让用户主动选择需要的面板

2. **按重要性设置可见性**
   - 核心功能：`visible: true`
   - 辅助功能：`visible: false`

3. **使用分类管理**
   - 将面板按功能分类
   - 便于批量管理

4. **添加清晰的描述**
   - 帮助用户理解面板用途
   - 便于维护

---

**配置完成！** 🎉
