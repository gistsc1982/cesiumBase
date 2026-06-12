#!/bin/bash
# CTB (Cesium Terrain Builder) 安装脚本
# 用于 Ubuntu/Linux 系统

set -e

echo "=========================================="
echo "  CTB (Cesium Terrain Builder) 安装脚本"
echo "  用于处理 DEM 数据生成 Cesium 地形"
echo "=========================================="

# 检查系统架构
ARCH=$(uname -m)
echo "系统架构: $ARCH"

if [ "$ARCH" != "x86_64" ]; then
    echo "⚠️  警告: CTB 主要支持 x86_64 架构"
fi

# 更新包列表
echo ""
echo "[1/6] 更新软件包列表..."
sudo apt update

# 安装基础依赖
echo ""
echo "[2/6] 安装基础构建工具..."
sudo apt install -y build-essential git cmake zlib1g-dev libcurl4-openssl-dev

# 安装 GDAL (地理数据处理核心库)
echo ""
echo "[3/6] 安装 GDAL..."
sudo apt install -y gdal-bin libgdal-dev

# 验证 GDAL 安装
echo ""
echo "验证 GDAL 安装:"
gdalinfo --version || echo "❌ GDAL 安装失败"

# 克隆 CTB 项目
echo ""
echo "[4/6] 下载 CTB 源码..."
CTB_DIR="/opt/cesium-terrain-builder"

if [ -d "$CTB_DIR" ]; then
    echo "CTB 目录已存在，跳过下载"
else
    sudo git clone https://github.com/geo-data/cesium-terrain-builder.git $CTB_DIR
    echo "✅ CTB 源码已下载到 $CTB_DIR"
fi

# 编译安装 CTB
echo ""
echo "[5/6] 编译 CTB..."
cd $CTB_DIR
mkdir -p build
cd build

cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

echo ""
echo "[6/6] 安装 CTB..."
sudo make install

# 验证安装
echo ""
echo "=========================================="
echo "验证安装:"
echo "=========================================="
which ctb-tile && echo "✅ ctb-tile 已安装" || echo "❌ ctb-tile 未找到"
which ctb-merge && echo "✅ ctb-merge 已安装" || echo "❌ ctb-merge 未找到"

echo ""
echo "=========================================="
echo "  CTB 安装完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 从地理空间数据云下载江西吉安的 DEM 数据"
echo "2. 使用 CTB 转换地形数据"
echo ""
echo "CTB 使用示例:"
echo "  ctb-tile -f input.tif -o output/ --zoom 0-14"
echo ""
