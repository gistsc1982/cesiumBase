# 离线地形数据处理执行步骤

## 🔧 需要手动执行的命令

由于需要 sudo 权限，请在终端中手动执行以下命令：

### 步骤 1：安装 GDAL 和 CTB 工具

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 安装依赖和编译工具
sudo apt update
sudo apt install -y gdal-bin libgdal-dev build-essential git cmake zlib1g-dev libcurl4-openssl-dev

# 克隆并编译 CTB
sudo git clone https://github.com/geo-data-cesium-terrain-builder.git /opt/cesium-terrain-builder
cd /opt/cesium-terrain-builder
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install
```

**预计时间**：10-20 分钟（编译耗时）

---

### 步骤 2：转换数据格式

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public

# 将 .img 格式转换为 GeoTIFF
gdal_translate -of GTiff -co COMPRESS=LZW ASTGTM_N26E114M.img ji_an.tif
```

---

### 步骤 3：切片地形数据

```bash
# 创建输出目录
mkdir -p terrain_tiles

# 使用 CTB 切片（生成 Cesium 地形瓦片）
ctb-tile -f ji_an.tif -o terrain_tiles/ \
    --zoom 0-14 \
    --forceresepect \
    --overwrite
```

**预计时间**：5-10 分钟

---

## 🎯 快速检查

### 验证 GDAL 安装
```bash
gdalinfo --version
```

### 验证 CTB 安装
```bash
ctb-tile --help
```

### 检查输入文件
```bash
gdalinfo ASTGTM_N26E114M.img
```

---

## ⚡ 一键执行（如果有 sudo 权限）

如果你有 sudo 权限，可以直接运行：

```bash
cd /home/tang/Documents/code/woonuxt-master01/cesiumBase/public
sudo bash process_terrain_complete.sh
```

---

## 📝 预期结果

执行成功后，`terrain_tiles/` 目录将包含：

```
terrain_tiles/
├── 0/
├── 1/
├── 2/
├── ...
└── 14/
```

每个目录包含对应缩放级别的地形瓦片文件。

---

## 🔗 完成后的配置

处理完成后，在 `src/components/LayerControl.vue` 中添加：

```javascript
/**
 * 加载本地离线地形（江西吉安）
 */
useLocalTerrain() {
  try {
    const localTerrain = new this.Cesium.CesiumTerrainProvider({
      url: './terrain_tiles/',
      requestWaterMask: false,
      requestVertexNormals: false
    });

    this.cesiumViewer.terrainProvider = localTerrain;
    this.currentLayer = 'swdx';

    // 确保有影像底图
    this.ensureImageryLayer();

    console.log('[LayerControl] ✅ 本地离线地形已启用（江西吉安）');
  } catch (error) {
    console.error('[LayerControl] ❌ 本本地形加载失败:', error);
  }
},
```

并在回退链中调用：
```javascript
.catch(() => {
  return this.useLocalTerrain();
})
```

---

## 💡 常见问题

### Q: sudo 密码输入错误
A: 确认用户有 sudo 权限，重新输入密码

### Q: 网络太慢
A: 使用国内镜像或离线安装包

### Q: 编译失败
A: 检查 build-essential 是否正确安装

---

## 📞 需要帮助？

执行过程中遇到问题，请提供：
1. 执行到哪一步
2. 具体的错误信息
3. 系统版本：`cat /etc/os-release`
