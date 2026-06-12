# 江西吉安 DEM 数据下载指南

## 📍 目标区域
- **省/市**：江西省 吉安市
- **经度范围**：114.0° ~ 115.5° E
- **纬度范围**：26.5° ~ 27.5° N
- **面积**：约 10,000 平方公里

---

## 🌐 数据源平台

### 推荐：地理空间数据云 (GSCloud)
- **网址**：https://www.gscloud.cn/
- **优势**：国内平台，免费，无需翻墙
- **数据**：SRTM 90m、SRTM 30m、ASTER GDEM 30m

---

## 📥 下载步骤

### 方法 1：在线下载（推荐）

1. **注册账号**
   - 访问 https://www.gscloud.cn/
   - 点击右上角"注册"
   - 填写信息完成注册

2. **搜索数据**
   - 登录后点击"数据检索"
   - 选择"DEM 数字高程模型"
   - 在地图上定位到江西吉安

3. **框选范围**
   ```
   经度：114.0° ~ 115.5° E
   纬度：26.5° ~ 27.5° N
   ```

4. **选择数据集**
   - 推荐使用 **ASTER GDEM V3 30m**（精度高，免费）
   - 或 **SRTM 90m**（数据量小）

5. **下载**
   - 选择下载格式：**TIF (GeoTIFF)**
   - 坐标系：**WGS84**
   - 点击"下载"

---

### 方法 2：命令行下载（需要 API Token）

```bash
# 使用 curl 下载（需要先获取 token）
curl -X POST "https://www.gscloud.cn/search/api/v1/file/filepage/list" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"searchTerm":"吉安", "dataProductIds":["DEM"], "page":1,"pageSize":10}'
```

---

## 🗂️ 数据格式要求

### CTB 支持的输入格式
- **GeoTIFF (.tif)** ✅ 推荐
- ** Erdas Imagine (.img)**
- **ENVI (.hdr)**
- **JPEG 2000 (.jp2)**
- **Raw binary**

### 数据参数要求
- **坐标系统**：WGS84 (EPSG:4326) 或 CGCS2000
- **数据类型**：16位或32位浮点型
- **无数据值**：-9999 或类似值

---

## 📊 数据量估算

| 分辨率 | 吉安市面积 | 预估数据量 |
|--------|-----------|-----------|
| SRTM 90m | ~10,000 km² | 50-100 MB |
| SRTM 30m | ~10,000 km² | 200-500 MB |
| ASTER GDEM 30m | ~10,000 km² | 200-500 MB |

**建议**：首次测试使用 SRTM 90m（数据量小）

---

## 🔗 快速链接

- 地理空间数据云：https://www.gscloud.cn/
- 用户注册：https://www.gscloud.cn/register/
- 数据检索：https://www.gscloud.cn/search/
- API 文档：https://www.gscloud.cn/doc/

---

## 📝 下载后检查

下载完成后，检查文件：
```bash
# 查看文件信息
gdalinfo downloaded_file.tif

# 检查坐标范围
gdalinfo downloaded_file.tif | grep "Upper Left\|Lower Right"

# 检查数据类型
gdalinfo downloaded_file.tif | grep "Type="
```

---

## ❓ 常见问题

### Q1: 下载需要多久？
A: 根据网速和数据大小，通常 5-20 分钟

### Q2: 数据太大无法下载？
A: 
- 框选更小的范围
- 选择更低分辨率（SRTM 90m）
- 分批下载相邻区域

### Q3: 下载后文件无法打开？
A: 使用 GDAL 或 QGIS 查看和处理

### Q4: 如何确认数据覆盖吉安？
A: 查看文件元数据中的坐标范围，确保包含 114.0°~115.5°E, 26.5°~27.5°N

---

## 🎯 下一步

下载 DEM 数据后：
1. ✅ 运行 `./install_ctb.sh` 安装 CTB
2. ⏭️ 跳转到 [CTB 转换指南](#ctb-转换指南)
