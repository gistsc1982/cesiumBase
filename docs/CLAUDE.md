# Claude Code 开发规范

## 代码修改检查清单

在修改代码后，必须执行以下检查：

### 1. 变量重复声明检查

**问题**：在同一个函数作用域中多次使用 `const` 或 `let` 声明同一个变量名，会导致打包错误。

**错误示例**：
```javascript
function handleZoomInUnified(deltaZoom) {
  // 函数开头声明
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  // ... 其他代码 ...

  // 函数后面再次声明（错误！）
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  if (!isUsingLocalCoord) {
    // ...
  }
}
```

**错误信息**：
```
Identifier "isUsingLocalCoord" has already been declared
```

**正确做法**：
1. **在函数开头声明一次**，整个函数中复用
2. **如果需要在后面使用**，添加注释说明变量已在前面声明
3. **使用 `grep` 检查**：在修改文件前，搜索变量名确保没有重复声明

**正确示例**：
```javascript
function handleZoomInUnified(deltaZoom) {
  // ⭐ 在函数开头声明一次
  const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem();

  // ... 其他代码 ...

  // ⭐ 后续使用时，添加注释说明已声明
  if (!isUsingLocalCoord) {  // isUsingLocalCoord 已在函数开头声明
    // ...
  }
}
```

### 2. 修改前检查步骤

在修改任何 JS/TS 文件前：

1. **使用 `Read` 工具查看文件**，了解现有结构
2. **使用 `Grep` 工具搜索变量名**，确认是否已声明
3. **修改完成后，检查语法**：
   ```bash
   node -c src/utils/YourFile.js
   ```

### 3. 常见错误模式

以下模式容易出现重复声明：

1. **多次检查同一条件**：
   ```javascript
   // ❌ 错误：多次声明
   const isLocalCoord = check();
   if (isLocalCoord) { ... }

   const isLocalCoord = check();  // 重复声明！
   if (isLocalCoord) { ... }

   // ✅ 正确：声明一次，复用
   const isLocalCoord = check();
   if (isLocalCoord) { ... }
   if (isLocalCoord) { ... }
   ```

2. **复制粘贴代码块**：
   复制粘贴代码时，忘记删除重复的变量声明

3. **函数分支中声明相同变量**：
   ```javascript
   // ❌ 错误
   if (condition1) {
     const result = calculate();
   }
   if (condition2) {
     const result = calculate();  // 重复声明
   }

   // ✅ 正确
   let result;
   if (condition1) {
     result = calculate();
   }
   if (condition2) {
     result = calculate();
   }
   ```

### 4. 检查命令

修改文件后，务必运行：

```bash
# 1. 语法检查
node -c src/utils/SyncManager.js

# 2. 尝试打包（如果语法通过）
npm run build
```

### 5. 历史问题记录

| 日期 | 文件 | 问题 | 解决方案 |
|------|------|------|----------|
| 2024-04-26 | SyncManager.js | `isUsingLocalCoord` 重复声明 | 在函数开头声明一次，后面使用时添加注释 |
| 2024-04-26 | SyncManager.js | 缩放函数中重复声明 `isUsingLocalCoord` | 删除后续重复声明，保留开头声明 |

## 记录新增问题

当遇到新的代码格式错误时，请在此文档中添加记录，格式参考上表。
