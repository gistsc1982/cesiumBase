# B3DM 转 GLB - 统一转换工具使用指南

## 概述

`convert-b3dm-unified.js` 是一个整合了两种转换模式的统一工具，可以自动处理：

1. **直接模式** - B3DM 的 RTC_CENTER 直接是完整 ECEF 坐标
2. **Tileset 模式** - 从 tileset.json 提取 transform，修复局部偏移的 RTC_CENTER

## 自动检测逻辑

脚本会自动检测输入类型：

- 如果第一个参数是 URL（http/https），使用 **Tileset 模式**
- 如果第一个参数是本地文件，使用 **直接模式**

## 使用方式

### 直接模式

适用于 RTC_CENTER 是完整 ECEF 坐标的 B3DM 文件。

```bash
# 基本用法
node convert-b3dm-unified.js <input.b3dm> [output.glb]

# 示例
node convert-b3dm-unified.js L16_10302.b3dm
node convert-b3dm-unified.js JiAn1_merge.b3dm my_output.glb
```

**特点**：
- 自动检测 RTC_CENTER 是否是有效的 ECEF 坐标
- 如果模长小于 1000 米，会发出警告
- 直接使用 B3DM 中的 RTC_CENTER 进行转换

### Tileset 模式

适用于 B3DM 的 RTC_CENTER 是局部偏移，需要从 tileset 获取完整 ECEF 坐标的情况。

```bash
# 基本用法
node convert-b3dm-unified.js <tileset_url> <b3dm_path> [output.glb]

# 示例
node convert-b3dm-unified.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  "Tile_%2B005_%2B005/Tile_%2B005_%2B005_L21_00000000.b3dm"
```

**特点**：
- 从主 tileset.json 提取 transform 矩阵
- 自动修复 B3DM 的 RTC_CENTER 为完整 ECEF 坐标
- 支持嵌套 tileset 结构

## 典型场景

### 场景 1：华为云 bridge3D Tileset

```bash
node convert-b3dm-unified.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  "Tile_%2B005_%2B005/Tile_%2B005_%2B005_L21_00000000.b3dm"
```

**输出**：
- 经度: 114.977875°
- 纬度: 27.116251°
- 高度: 0m (修正自 -5.78m)

### 场景 2：华为云 JiAn1_merge Tileset

JiAn1_merge.json 没有 transform，但其 B3DM 包含完整 ECEF 坐标，使用直接模式：

```bash
# 先下载 B3DM 文件
curl -s "https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.b3dm" -o JiAn1_merge.b3dm

# 转换
node convert-b3dm-unified.js JiAn1_merge.b3dm
```

**输出**：
- 经度: 114.920133°
- 纬度: 27.111651°
- 高度: 0m (修正自 -53.41m)

### 场景 3：本地 B3DM 文件

```bash
# 完整 ECEF 坐标
node convert-b3dm-unified.js /path/to/L16_10302.b3dm

# 局部偏移（会发出警告）
node convert-b3dm-unified.js /path/to/Tile_+005_+005.b3dm
```

## 输出说明

### 生成的 GLB 文件包含以下元数据：

```json
{
  "asset": {
    "extras": {
      "_b3dm": {
        "rtcCenter": [-2398915.11, 5149680.83, 2889684.20],
        "batchLength": 0,
        "geolocation": {
          "longitude": 114.977875,
          "latitude": 27.116251,
          "altitude": 0,
          "originalAltitude": -5.78,
          "source": "B3DM_RTC_CENTER_AUTO_CONVERTED"
        },
        "geometryTransformed": true
      },
      "_geolocation": {
        "longitude": 114.977875,
        "latitude": 27.116251,
        "altitude": 0,
        "source": "B3DM_RTC_CENTER"
      },
      "_axisConversion": {
        "method": "PCA_Ground_Alignment",
        "rotationMatrix": [...],
        "geometryTransformed": true
      }
    }
  }
}
```

### 输出文件命名规则：

| 输入 | 模式 | 输出文件 |
|------|------|----------|
| `L16_10302.b3dm` | Direct | `L16_10302_ECEF_to_ThreeJS.glb` |
| `Tile_%2B005_%2B005/...b3dm` | Tileset | `Tile_+005_+005_..._ECEF_to_ThreeJS.glb` |

## PCA 贴地对齐

脚本使用主成分分析 (PCA) 自动计算模型的贴地对齐：

1. **分析顶点分布** - 找到模型的三个主方向
2. **识别地面法线** - 最小特征值对应的特征向量
3. **计算旋转矩阵** - 将法线对齐到 Y 轴正方向
4. **应用旋转变换** - 转换所有顶点和法线

## 高度修正

脚本会自动检测并修正负高度：

- **原始高度 < 0** → 调整为 0m
- **原因**：负高度会导致相机定位到地下，倾斜摄影无法正确渲染
- **保留原始值**：`originalAltitude` 字段

## 故障排除

### 问题 1：Tileset 模式报错 "没有找到 transform"

**原因**：tileset.json 没有 transform 字段

**解决**：
- 检查 B3DM 是否包含完整 ECEF 坐标
- 如果是，使用直接模式：`node convert-b3dm-unified.js <b3dm_file>`

### 问题 2：直接模式警告 "不像有效的 ECEF 坐标"

**原因**：RTC_CENTER 模长小于 1000 米

**解决**：
- 检查是否应该使用 Tileset 模式
- 提供完整的 tileset URL 和 B3DM 路径

### 问题 3：HTTP 下载失败

**原因**：URL 不正确或需要 URL 编码

**解决**：
- 将 `+` 替换为 `%2B`
- 将空格替换为 `%20`
- 检查网络连接

## 与其他脚本的比较

| 特性 | convert-b3dm-ECEF-to-glb.js | convert-obs-tileset.js | convert-b3dm-unified.js |
|------|----------------------------|------------------------|-------------------------|
| 直接模式 | ✅ | ❌ | ✅ |
| Tileset 模式 | ❌ | ✅ | ✅ |
| 自动检测 | ❌ | ❌ | ✅ |
| URL 编码处理 | N/A | ✅ | ✅ |
| PCA 贴地对齐 | ✅ | ✅ | ✅ |
| 负高度修正 | ✅ | ✅ | ✅ |

## 最佳实践

1. **优先使用统一工具** - `convert-b3dm-unified.js` 自动选择正确模式
2. **检查输出地理位置** - 确认经纬度和高度符合预期
3. **验证 GLB 文件** - 在 DualCanvasViewer 中加载测试
4. **保留原始 B3DM** - 转换前备份原始文件

## 示例脚本

批量转换多个 B3DM 文件：

```bash
#!/bin/bash

# 直接模式批量转换
for file in *.b3dm; do
  echo "Converting $file..."
  node convert-b3dm-unified.js "$file"
done

# Tileset 模式批量转换
TILESET_URL="https://.../tileset.json"
for tile in Tile_%2B005_%2B005/*.b3dm; do
  echo "Converting $tile..."
  node convert-b3dm-unified.js "$TILESET_URL" "$tile"
done
```

## 技术细节

### ECEF 坐标验证

脚本使用以下规则判断坐标是否有效：

```javascript
function isValidECEFCoordinate(coords) {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  // ECEF 坐标的模长应该接近地球半径（约 6371 km）
  return magnitude > 1000; // 米
}
```

### Transform 提取

从 tileset transform 矩阵提取 ECEF 位置：

```javascript
const transform = tileset.root.transform; // 4x4 矩阵
const ecefPosition = [
  transform[12], // X
  transform[13], // Y
  transform[14]  // Z
];
```

## 更新日志

- **2026-05-29**: 创建统一转换工具，整合直接模式和 Tileset 模式
- 支持 URL 编码处理
- 自动检测输入类型
- 负高度自动修正
