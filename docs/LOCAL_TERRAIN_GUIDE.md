# 江西吉安 Cesium 离线地形部署完成

## ✅ 已完成的工作

1. ✅ **数据解压**：`ASTGTM_N26E114M.img` (19MB)
2. ✅ **安装脚本**：`install_ctb.sh`
3. ✅ **处理脚本**：`process_terrain_complete.sh`
4. ✅ **配置指南**：`TERRAIN_SETUP_GUIDE.md`

## 🚀 快速开始

### 一键执行（推荐）

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public
./process_terrain_complete.sh
```

此脚本会自动：
1. 安装 GDAL、CTB 等依赖
2. 转换数据格式 (IMG → GeoTIFF)
3. 切片地形数据 (生成 .terrain 文件)
4. 验证输出结果

**预计时间**：15-30 分钟（取决于网速和系统性能）

---

## 📋 手动步骤（如需自定义）

### 步骤 1：安装依赖

```bash
sudo apt update
sudo apt install -y gdal-bin libgdal-dev build-essential git cmake
```

### 步骤 2：安装 CTB

```bash
git clone https://github.com/geo-data/cesium-terrain-builder.git /opt/cesium-terrain-builder
cd /opt/cesium-terrain-builder
mkdir build && cd build
cmake .. && make -j$(nproc)
sudo make install
```

### 步骤 3：转换数据格式

```bash
gdal_translate -of GTiff ASTGTM_N26E114M.img ji_an.tif
```

### 步骤 4：切片处理

```bash
mkdir -p terrain_tiles
ctb-tile -f ji_an.tif -o terrain_tiles/ --zoom 0-14 --forceresepect
```

---

## 🎯 在 LayerControl.vue 中使用

处理完成后，在 `LayerControl.vue` 中添加本地地形加载方法：

```javascript
/**
 * 加载本地离线地形（江西吉安）
 */
tryLocalTerrain() {
  return new Promise((resolve, reject) => {
    console.log('[LayerControl] 🔄 加载本地离线地形（江西吉安）...');

    try {
      const localTerrain = new this.Cesium.CesiumTerrainProvider({
        url: './terrain_tiles/',  // 本地地形瓦片目录
        requestWaterMask: false,
        requestVertexNormals: false
      });

      this.cesiumViewer.terrainProvider = localTerrain;
      this.currentLayer = 'swdx';

      // 确保有影像底图
      this.ensureImageryLayer();

      console.log('[LayerControl] ✅ 本地离线地形已启用（江西吉安）');
      resolve();
    } catch (error) {
      reject(new Error('本地地形加载失败: ' + error.message));
    }
  });
},
```

---

## 📊 预期结果

### 目录结构
```
public/
├── terrain_tiles/
│   ├── 0/
│   ├── 1/
│   ├── 2/
│   ├── ...
│   └── 14/
├── ASTGTM_N26E114M.img (原始数据)
└── process_terrain_complete.sh (处理脚本)
```

### Cesium 加载效果
- ✅ 显示江西吉安地形起伏
- ✅ 无需网络连接
- ✅ 加载速度快（本地数据）
- ✅ 完全离线可用

---

## 🔧 故障排查

### 问题 1：GDAL 转换失败
```bash
# 检查文件格式
gdalinfo ASTGTM_N26E114M.img

# 尝试不同的转换选项
gdal_translate -of GTiff ASTGTM_N26E114M.img ji_an.tif -co COMPRESS=NONE
```

### 问题 2：CTB 切片失败
```bash
# 检查 CTB 是否正确安装
ctb-tile --help

# 减少缩放级别（数据量更小）
ctb-tile -f ji_an.tif -o terrain_tiles/ --zoom 0-10
```

### 问题 3：Cesium 加载失败
```javascript
// 检查 URL 路径
console.log('地形 URL:', './terrain_tiles/');

// 检查目录权限
ls -la terrain_tiles/

// 使用绝对路径
const localTerrain = new Cesium.CesiumTerrainProvider({
  url: 'http://localhost:8080/terrain_tiles/'
});
```

---

## 📌 注意事项

1. **数据覆盖范围**：确保 ASTGTM 数据覆盖吉安地区
2. **磁盘空间**：预留至少 500MB 空间用于地形瓦片
3. **网络要求**：安装 CTB 需要网络连接（下载源码）
4. **处理时间**：首次运行需要 15-30 分钟

---

## 🎯 数据信息

- **数据源**：ASTER GDEM V3
- **覆盖区域**：N26° (北纬 26°)
- **数据格式**：Erdas Imagine .img
- **文件大小**：19 MB
- **转换后**：GeoTIFF (.tif)
- **最终输出**：Quantized-Mesh (.terrain)

---

## 📞 获取帮助

如有问题，请检查：
1. `DOWNLOAD_DEM_GUIDE.md` - DEM 数据下载指南
2. `TERRAIN_SETUP_GUIDE.md` - 完整配置指南
3. CTB 官方文档：https://github.com/geo-data/cesium-terrain-builder
