# modelGroup1 修复说明

## 问题描述
层1的 modelGroup1 未被成功添加至 rendererManager 的场景。

## 修复内容

### 1. 在 initThreeLayer 函数中
- 为 `modelGroup1` 添加了名称 `'modelGroup1'` 以便识别
- 添加了验证代码，确认 `modelGroup1` 已成功添加到 `scene1`
- 在 `addScene` 调用后添加了验证，确认 `scene1` 已成功添加到 `rendererManager`

### 2. 在 initBimLayer 函数中
- 为 `modelGroup2` 添加了名称 `'modelGroup2'` 以便识别
- 添加了验证代码，确认 `modelGroup2` 已成功添加到 `scene2`
- 在 `addScene` 调用后添加了验证，确认 `scene2` 已成功添加到 `rendererManager`

### 3. 在模型加载时
- 添加了保护措施，确保 `modelGroup1` 始终在 `scene1` 中
- 如果发现 `modelGroup1` 不在 `scene1` 中，会自动重新添加

## 诊断输出

修改后，应用会在控制台输出以下诊断信息：

```
[DualCanvasViewer] ✅ modelGroup1 已成功添加到 scene1 (位置: X)
[DualCanvasViewer] ✅ scene1 已成功添加到 rendererManager (场景索引: 0)
[DualCanvasViewer] modelGroup1 在 scene1 中: ✅
[DualCanvasViewer] modelGroup1 子对象数量: 0
```

## 如何使用

1. 重新启动应用
2. 打开浏览器控制台
3. 查看诊断输出，确认 modelGroup1 的状态

## 预期结果

- modelGroup1 应该成功添加到 scene1
- scene1 应该成功添加到 rendererManager
- 模型加载时，modelGroup1 应该始终在 scene1 中

## 如果问题仍然存在

如果控制台显示错误（❌），请运行以下诊断脚本：

```javascript
// 在浏览器控制台运行
const rm = window.rendererManager;
const scenes = rm.getScenes();

scenes.forEach((s, i) => {
  const scene = s.scene;
  console.log(`场景 ${i}:`, scene.uuid);

  const groups = scene.children.filter(c => c.type === 'Group');
  groups.forEach((g, j) => {
    console.log(`  [${j}] ${g.name}: ${g.children.length} 个子对象`);
  });
});
```
