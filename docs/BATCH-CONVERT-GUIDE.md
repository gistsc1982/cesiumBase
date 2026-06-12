# B3DM 批量层级转换工具使用指南

## 概述

`convert-b3dm-batch.js` 是一个专门用于按 3D Tiles 层级批量转换 B3DM 文件的工具。

### 核心功能

1. **自动分析 tileset 结构** - 递归遍历嵌套的 tileset JSON 文件
2. **层级统计** - 按层级（L18-L23）统计文件数量
3. **批量转换** - 转换指定层级的所有 B3DM 文件
4. **完整 PCA 对齐** - 自动贴地对齐处理
5. **URL 编码处理** - 自动处理 `+` 等特殊字符

## 使用方式

### 1. 列出所有可用层级

```bash
node convert-b3dm-batch.js <tileset_url> --list-levels
```

**示例**：
```bash
node convert-b3dm-batch.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  --list-levels
```

**输出示例**：
```
📊 层级分布:
  层级     | 文件数 | 说明
  --------------------------------------------------
  L18      |     36 | 层级 18
  L19      |    504 | 层级 19
  L20      |   1902 | 层级 20
  L21      |   9262 | 层级 21
  L22      |   5357 | 层级 22
  L23      |     61 | 层级 23
  --------------------------------------------------
  总计     |  17247 |
```

### 2. 转换单个层级

```bash
node convert-b3dm-batch.js <tileset_url> --level L23 [output_dir]
```

**示例**：
```bash
node convert-b3dm-batch.js \
  "https://.../tileset.json" \
  --level L23 \
  output
```

### 3. 转换多个层级

```bash
node convert-b3dm-batch.js <tileset_url> --level L21,L22,L23 [output_dir]
```

**示例**：
```bash
node convert-b3dm-batch.js \
  "https://.../tileset.json" \
  --level L20,L21,L22 \
  output
```

### 4. 转换所有层级

```bash
node convert-b3dm-batch.js <tileset_url> --all [output_dir]
```

## 层级说明

| 层级范围 | 说明 | 地理范围 | Three.js 占用面积 |
|---------|------|---------|-------------------|
| L10-L14 | 大范围概览 | 几公里 | 大 |
| L15-L18 | 中等精度 | 几百米 | 中等 |
| L19-L23 | 高精度 | 几十米 | 小 |

**规律**：
- **层级数字越大** → 数据越精细 → 覆盖范围越小 → Three.js 占用面积越小
- **层级数字越小** → 数据越粗略 → 覆盖范围越大 → Three.js 占用面积越大

## 转换结果

### 输出文件命名

输入：`Tile_+002_+006_L23_0001105400.b3dm`
输出：`Tile_+002_+006_L23_0001105400_ECEF_to_ThreeJS.glb`

### 元数据结构

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
          "source": "BATCH_CONVERT"
        },
        "geometryTransformed": true
      },
      "_geolocation": {
        "longitude": 114.977875,
        "latitude": 27.116251,
        "altitude": 0,
        "source": "BATCH_CONVERT"
      },
      "_axisConversion": {
        "method": "PCA_Ground_Alignment",
        "rotationMatrix": [...],
        "geometryTransformed": true,
        "fixDate": "2026-05-29T..."
      }
    }
  }
}
```

## 实际案例

### 案例 1：华为云 bridge3D Tileset

```bash
# 1. 查看层级分布
node convert-b3dm-batch.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  --list-levels

# 2. 转换最高精度层级 (L23)
node convert-b3dm-batch.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  --level L23 \
  output

# 3. 转换高精度层级 (L21-L23)
node convert-b3dm-batch.js \
  "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json" \
  --level L21,L22,L23 \
  output
```

**结果**：
- L23: 61 个文件，成功 61，失败 0
- 输出目录: `output/`

### 案例 2：华为云 JiAn1_merge Tileset

```bash
# 1. 查看层级分布
node convert-b3dm-batch.js \
  "https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.json" \
  --list-levels

# 2. 转换所有层级
node convert-b3dm-batch.js \
  "https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.json" \
  --all \
  output
```

## 批处理脚本

### 转换指定层级到不同目录

```bash
#!/bin/bash
TILESET="https://.../tileset.json"

# 为每个层级创建单独的目录
for level in L20 L21 L22 L23; do
  echo "转换层级 $level..."
  mkdir -p "output_$level"
  node convert-b3dm-batch.js "$TILESET" --level $level "output_$level"
done
```

### 进度监控

```bash
#!/bin/bash
# 监控转换进度
watch -n 5 'ls output/*.glb 2>/dev/null | wc -l'
```

## 性能考虑

### 文件数量统计

| 层级 | 文件数 | 预计时间 | 磁盘空间 |
|-----|--------|---------|---------|
| L18 | 36 | ~2 分钟 | ~50 MB |
| L19 | 504 | ~15 分钟 | ~500 MB |
| L20 | 1902 | ~45 分钟 | ~2 GB |
| L21 | 9262 | ~3 小时 | ~8 GB |
| L22 | 5357 | ~2 小时 | ~5 GB |
| L23 | 61 | ~2 分钟 | ~100 MB |

### 优化建议

1. **分批转换** - 不要一次性转换所有层级
2. **并行处理** - 使用多个终端同时转换不同层级
3. **磁盘空间** - 确保有足够的磁盘空间
4. **网络稳定** - 确保网络连接稳定

## 故障排除

### 问题 1：子 tileset 加载失败

**症状**：`⚠️ 无法加载子 tileset`

**原因**：URL 编码问题

**解决**：脚本已自动处理 `+` → `%2B` 编码

### 问题 2：找不到 B3DM 文件

**症状**：`✅ 找到 0 个 B3DM 文件`

**原因**：
- Tileset 结构特殊
- URL 不正确

**解决**：
- 检查 URL 是否正确
- 使用 `--list-levels` 验证

### 问题 3：转换失败

**症状**：`❌ 失败: ...`

**原因**：
- 网络问题
- B3DM 文件损坏
- 磁盘空间不足

**解决**：
- 检查网络连接
- 检查磁盘空间
- 查看详细错误信息

## 与其他工具的比较

| 功能 | convert-b3dm-unified.js | convert-b3dm-batch.js |
|------|------------------------|----------------------|
| 单文件转换 | ✅ | ❌ |
| 层级批量转换 | ❌ | ✅ |
| 自动分析 tileset | ❌ | ✅ |
| 层级统计 | ❌ | ✅ |
| 嵌套 tileset 支持 | ✅ | ✅ |
| URL 编码处理 | ✅ | ✅ |
| PCA 对齐 | ✅ | ✅ |

## 使用建议

### 开发测试阶段

```bash
# 只转换 L23 层级（文件最少）
node convert-b3dm-batch.js "$TILESET" --level L23 test_output
```

### 生产环境

```bash
# 按需转换高精度层级
node convert-b3dm-batch.js "$TILESET" --level L21,L22,L23 production_output
```

### 完整备份

```bash
# 转换所有层级（耗时较长）
node convert-b3dm-batch.js "$TILESET" --all full_backup
```

## 技术细节

### URL 编码处理

脚本自动处理特殊字符：
- `+` → `%2B`
- 空格 → `%20`

### 递归加载

```javascript
// 自动加载嵌套的 tileset JSON
if (uri.endsWith('.json')) {
  const encodedUri = uri.replace(/\+/g, '%2B');
  const fullPath = baseUrl + encodedUri;
  // 递归处理
}
```

### 去重机制

使用 `visited` Set 避免重复加载相同的 tileset：
```javascript
if (visited.has(fullPath)) {
  console.log(`⏭️  跳过已加载: ${uri}`);
} else {
  visited.add(fullPath);
  // 加载处理
}
```

## 总结

`convert-b3dm-batch.js` 是处理大规模 3D Tiles 数据的理想工具：

1. **自动化程度高** - 自动分析、统计、转换
2. **层级化处理** - 按需转换指定层级
3. **完整的转换流程** - 包含 PCA 对齐、元数据等
4. **鲁棒性强** - 处理嵌套 tileset、URL 编码等

适用于需要批量处理华为云 OBS 等 3D Tiles 服务的场景。
