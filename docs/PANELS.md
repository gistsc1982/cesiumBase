# 功能面板配置说明

## 📋 当前可用面板

目前系统中有 **2个** 功能面板：

| 面板名称 | 文件名 | 状态 | 默认可见 | 图标 | 分类 |
|----------|--------|------|----------|------|------|
| TestPanel | TestPanel.vue | ✅ 已启用 | ❌ 不可见 | 🧪 | 测试 |
| ObliquePhotographyPanel | ObliquePhotographyPanel.vue | ✅ 已启用 | ❌ 不可见 | 📷 | 工具 |

---

## 🎯 配置说明

### TestPanel（测试面板）
- **用途：** 测试自动加载功能
- **默认状态：** 启用但不可见
- **使用场景：** 开发测试

### ObliquePhotographyPanel（倾斜摄影面板）
- **用途：** 倾斜摄影模型加载和管理
- **默认状态：** 启用但不可见
- **使用场景：** 加载和管理 3D 倾斜摄影模型

---

## 🔧 修改面板可见性

编辑 `functionPanels.config.json` 文件，修改对应面板的 `visible` 字段：

```json
{
  "name": "TestPanel",
  "visible": true  // 改为 true 则默认显示
}
```

---

## 📖 添加新面板

当有新的面板时，按以下格式添加到配置文件：

```json
{
  "name": "NewPanel",
  "file": "NewPanel.vue",
  "title": "新面板",
  "description": "面板描述",
  "enabled": true,
  "visible": false,
  "icon": "🔧",
  "category": "tools",
  "permissions": []
}
```

**注意事项：**
1. `name` 必须与组件的 `name` 属性完全一致
2. `file` 必须与文件名完全一致（包括大小写）
3. 新增面板后需刷新浏览器才能生效

---

## 🎮 快捷操作

### 浏览器控制台

```javascript
// 查看配置
window.__functionPanelsConfig__

// 查看配置管理器
window.__functionPanelsConfigManager__

// 查看统计
window.__functionPanelsConfigManager__.getStats()

// 检查面板是否可见
window.__functionPanelsConfigManager__.isPanelVisible('TestPanel')
```

---

**最后更新：** 2024-06-12
