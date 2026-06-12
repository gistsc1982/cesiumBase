# 方案C：统一坐标系统 - 实施说明

## 修改内容

### 1. convert-b3dm-batch.js 修改

**文件位置**: `/cesiumBase/public/convert-b3dm-batch.js`

**修改点1**: 禁用地面对齐旋转（第775-795行）
```javascript
// ⭐ 方案C：统一坐标系统 - 禁用地面对齐旋转
let rotationMatrix = null;

if (!quiet) {
  console.log(`  ⏭️  方案C：统一坐标系统 - 跳过地面对齐旋转`);
  console.log(`     说明：让 Dual 渲染器完全接管坐标转换和定位`);
  console.log(`     好处：避免坐标系冲突，确保模型朝向正确`);
}

// 不应用旋转，直接使用原始 GLB 数据
const modifiedGLTF = gltf;
const modifiedBinaryChunk = binaryChunk;
```

**修改点2**: 确保 geometryTransformed 始终为 false（第810-837行）
```javascript
modifiedGLTF.asset.extras._b3dm = {
  rtcCenter: finalECEF,
  batchLength: b3dm.featureTable.BATCH_LENGTH || 0,
  geolocation: {
    longitude: geolocation.longitude,
    latitude: geolocation.latitude,
    altitude: finalAltitude,
    originalAltitude: originalAltitude,
    source: 'BATCH_CONVERT'
  },
  geometryTransformed: false  // 始终为 false，让 Dual 渲染器处理坐标
};

// ⭐ 方案C：不添加 _axisConversion 元数据，因为不进行任何旋转变换
// 移除此块代码，确保 GLB 文件不包含旋转矩阵信息
```

## 问题原因分析

### 问题1：GLB模型被"按地球法线旋转"

**原因**:
- 原始代码使用PCA主成分分析提取模型的法线方向
- ECEF坐标系中，模型的"向上"方向近似于地球法线
- 代码强制将这个方向旋转到Y轴 `[0, 1, 0]`
- 结果：模型被"按地球法线旋转"，产生错误的朝向

**解决方案**:
- 禁用地面对齐旋转
- 保留原始ECEF坐标系中的几何数据
- 让Dual渲染器通过ENU坐标系统处理定位

### 问题2：Dual渲染器和Cesium渲染器显示范围差异

**原因**:
- 转换脚本添加了旋转矩阵到GLB文件
- Dual渲染器加载GLB时，旋转信息与ENU坐标系统冲突
- Cesium渲染器直接使用原始B3DM，坐标系统统一

**解决方案**:
- 确保GLB文件不包含任何几何变换
- geometryTransformed 始终为 false
- 所有坐标转换由Dual渲染器的MercatorProjectionManager处理

## 转换流程（方案C）

```
B3DM文件（ECEF坐标）
    ↓
提取GLB数据（不旋转）
    ↓
添加元数据：
  - RTC_CENTER（ECEF坐标）
  - 经纬度（从ECEF反算）
  - geometryTransformed: false
    ↓
生成GLB文件
    ↓
Dual渲染器加载：
  - 识别RTC_CENTER
  - 转换到墨卡托坐标系
  - 应用ENU变换
  - 正确定位模型
```

## 验证步骤

### 1. 重新转换L16层级模型

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 转换L16层级
node convert-b3dm-batch.js https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.json --level L16
```

### 2. 检查转换日志输出

应该看到：
```
⏭️  方案C：统一坐标系统 - 跳过地面对齐旋转
   说明：让 Dual 渲染器完全接管坐标转换和定位
   好处：避免坐标系冲突，确保模型朝向正确
```

### 3. 验证GLB文件元数据

可以使用GLTF验证工具检查：
- `asset.extras._b3dm.geometryTransformed` 应该是 `false`
- `asset.extras._axisConversion` 不应该存在

### 4. 在Dual渲染器中测试

1. 加载转换后的GLB文件
2. 对比Cesium渲染器中的原始B3DM
3. 检查模型朝向是否一致
4. 检查显示范围是否一致

## 预期效果

- ✅ 模型不再"按地球法线旋转"
- ✅ 模型朝向与Cesium渲染器一致
- ✅ 显示范围与Cesium渲染器一致
- ✅ 坐标系统统一，无变换冲突

## 技术细节

### ECEF到ENU转换流程

1. **ECEF坐标**（地心地固坐标系）:
   - 原点：地球中心
   - Z轴：指向北极
   - X轴：指向本初子午线
   - Y轴：指向东经90度

2. **墨卡托投影**（Web Mercator EPSG:3857）:
   - 将经纬度投影到平面
   - 适用于Web地图显示

3. **ENU坐标系**（East-North-Up）:
   - 原点：模型位置的地形表面
   - E轴：东
   - N轴：北
   - U轴：天顶（垂直于地表向上）

### Dual渲染器的坐标处理

```javascript
// DualCanvasViewer.vue 中的处理流程

1. 读取 RTC_CENTER（ECEF坐标）
2. 反算经纬度
3. 转换到墨卡托坐标系
4. 设置 ENU 原点（地形表面）
5. 应用 ENU 变换矩阵
6. 模型正确定位
```

## 关键代码位置

### 转换脚本
- `/cesiumBase/public/convert-b3dm-batch.js`
  - 第775-795行：禁用地面对齐旋转
  - 第810-837行：设置 geometryTransformed = false

### Dual渲染器
- `/cesiumBase/src/components/DualCanvasViewer.vue`
  - 第7129-7243行：extractGeolocationFromGLTFAsset - 提取地理位置
  - 第8124-8438行：处理GLTF资产中的地理位置信息
  - 第1173-1245行：repositionModelsWithENU - ENU重新定位

## 日期

- 实施日期：2026-05-29
- 修改文件：convert-b3dm-batch.js
