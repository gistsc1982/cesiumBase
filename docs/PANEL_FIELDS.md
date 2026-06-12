# 功能面板配置字段说明

## 📋 完整字段列表

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
| `position` | object | ❌ | `{initialX: 'center', initialY: 100}` | 面板初始位置 |

---

## 📍 position 字段说明

### position 对象结构

```json
{
  "position": {
    "initialX": "center" | "right" | "left" | number,
    "initialY": number
  }
}
```

### initialX 可选值

| 值 | 说明 | 示例 |
|------|------|------|
| `'center'` | 居中显示 | 屏幕中央 |
| `'right'` | 靠右显示 | 距离右边缘 20px |
| `'left'` | 靠左显示 | 距离左边缘 20px |
| `number` | 指定像素值 | `initialX: 300` 表示距离左边缘 300px |

### initialY 说明

| 类型 | 说明 |
|------|------|
| `number` | 距离屏幕顶部的像素值（例如：`initialY: 100` 表示距离顶部 100px）|

---

## 📝 配置示例

### 示例 1：完整配置

```json
{
  "name": "TestPanel",
  "file": "TestPanel.vue",
  "title": "测试面板",
  "description": "测试自动加载功能的面板",
  "enabled": true,
  "visible": true,
  "icon": "🧪",
  "category": "test",
  "permissions": [],
  "position": {
    "initialX": "right",
    "initialY": 100
  }
}
```

**效果：** 面板在页面加载时自动显示，位于屏幕右侧，距离顶部 100px

---

### 示例 2：居中显示

```json
{
  "name": "ToolPanel",
  "file": "ToolPanel.vue",
  "title": "工具面板",
  "enabled": true,
  "visible": false,
  "position": {
    "initialX": "center",
    "initialY": 150
  }
}
```

**效果：** 面板不会自动显示，手动打开后位于屏幕中央，距离顶部 150px

---

### 示例 3：指定像素位置

```json
{
  "name": "ControlPanel",
  "file": "ControlPanel.vue",
  "title": "控制面板",
  "position": {
    "initialX": 500,
    "initialY": 200
  }
}
```

**效果：** 面板位于距离左边缘 500px、距离顶部 200px 的位置

---

## 🎯 当前面板配置

### TestPanel（测试面板）

```json
{
  "name": "TestPanel",
  "visible": true,
  "position": {
    "initialX": "right",  // 靠右显示
    "initialY": 100       // 距离顶部 100px
  }
}
```

### ObliquePhotographyPanel（倾斜摄影面板）

```json
{
  "name": "ObliquePhotographyPanel",
  "visible": false,
  "position": {
    "initialX": "center",  // 居中显示
    "initialY": 120        // 距离顶部 120px
  }
}
```

---

## 💡 使用建议

1. **避免重叠**：为不同面板设置不同的 `initialX` 和 `initialY` 值
2. **常用位置**：
   - 主工具面板：`initialX: "right"`（右侧，便于访问）
   - 辅助面板：`initialX: "center"`（中央，突出显示）
   - 状态面板：`initialX: "left"`（左侧，信息展示）
3. **测试调整**：先设置 `visible: true` 查看位置效果，再决定最终位置

---

**配置完成！** 🎉
