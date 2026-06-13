# 目录浏览功能更新说明

## 更新日期
2026-06-13

## 问题描述
原来的导入配置对话框只能显示 `/data/` 根目录下的文件，无法浏览和导航到子目录（如 `/data/gis/`），导致用户无法访问 `oblique_photography.json` 等子目录中的配置文件。

## 解决方案
添加了完整的目录导航功能，支持：
- 显示子目录列表
- 点击目录进入子目录
- 返回上级目录
- 显示当前所在目录路径

## 更新内容

### 1. 数据结构更新
在 `ObliquePhotographyPanel.vue` 中添加了新的数据属性：
```javascript
allFilesMap: new Map(),  // 文件路径到文件对象的映射
```

### 2. 计算属性
添加了以下计算属性来处理目录导航：

- **currentDirectoryFiles** - 获取当前目录的文件列表
- **currentSubdirectories** - 获取当前目录的子目录列表
- **currentDirectoryDisplay** - 获取当前目录的显示路径
- **canGoBack** - 判断是否可以返回上级目录

### 3. 导航方法
添加了目录导航方法：

- **navigateToDirectory(dirName)** - 进入指定的子目录
- **navigateToParentDirectory()** - 返回上级目录

### 4. UI 更新
更新了文件浏览对话框的 UI：
- 添加了"返回"按钮（当不在根目录时显示）
- 显示当前完整目录路径
- 子目录以文件夹图标显示在列表顶部
- 文件以文件图标显示在子目录后面

### 5. CSS 样式
添加了新的样式类：
- `.nav-btn` - 导航按钮样式
- `.back-btn` - 返回按钮样式
- `.directory-item` - 目录项悬停样式

## 功能特性

### 目录导航
```
/data/                      ← 根目录
  📁 gis/                   ← 点击进入子目录
  📁 config4user/
  📄 other.json

/data/gis/                  ← 子目录
  🔙 返回                   ← 返回上级目录
  📄 oblique_photography.json
  📄 other_gis_config.json
```

### 文件图标
- 📁 文件夹（子目录）
- 📄 文件
- 📂 目录操作图标
- 📥 导入操作图标
- 🔙 返回按钮

### 按钮功能
- **返回** - 返回上级目录（仅在非根目录时显示）
- **刷新** - 重新加载服务器文件列表
- **取消** - 关闭导入对话框
- **目录** - 点击进入子目录
- **文件** - 点击选择并导入

## 使用示例

### 浏览子目录
1. 打开"导入配置"对话框
2. 点击 `gis/` 文件夹进入子目录
3. 看到子目录中的文件列表（如 `oblique_photography.json`）
4. 点击文件名选择并导入

### 返回上级
1. 在子目录中点击"返回"按钮
2. 返回到上一级目录
3. 可以继续浏览其他子目录

## 技术细节

### 目录路径处理
- 目录路径使用 `/` 作为分隔符（跨平台兼容）
- 根目录表示为空字符串 `''`
- 子目录路径示例：`gis`, `config4user/user1`

### 文件过滤逻辑
```javascript
// 获取当前目录的文件
const currentDir = this.currentServerDirectory || '';
const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
return fileDir === currentDir;
```

### 子目录提取逻辑
```javascript
// 从文件路径中提取直接子目录
let relativePath = fileDir.substring(currentDir.length + 1);
const firstSlash = relativePath.indexOf('/');
if (firstSlash === -1) {
  // 直接子目录
  subdirs.add(relativePath);
} else {
  // 嵌套子目录的第一级
  subdirs.add(relativePath.substring(0, firstSlash));
}
```

## 兼容性
- ✅ 支持多层嵌套目录
- ✅ 支持跨平台路径分隔符
- ✅ 保留原有功能不变
- ✅ 向后兼容现有数据

## 测试建议
1. 测试进入子目录功能
2. 测试返回上级目录功能
3. 测试在嵌套目录中导航
4. 测试从不同目录导入文件
5. 测试空目录的处理
6. 测试网络错误时的行为

## 注意事项
- 服务器需要正常运行（端口 8081）
- 目录浏览依赖于 API 服务器的 `/api/configs` 端点
- 文件导入时显示的文件名可能包含路径信息
- 关闭对话框后会保留浏览位置（便于重新打开时继续浏览）
