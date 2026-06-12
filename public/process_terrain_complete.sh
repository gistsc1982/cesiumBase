#!/bin/bash
# Cesium 离线地形数据处理完整脚本
# 完全在用户目录下执行，无需sudo权限
# 智能检测已安装的 GDAL 和 CTB 工具

set -e

echo "=================================================="
echo "  Cesium 离线地形数据处理完整工具"
echo "  适用于江西吉安 ASTGTM 数据"
echo "  智能检测已安装工具"
echo "=================================================="

# 检查当前目录
WORK_DIR="$(pwd)"
if [ ! -f "$WORK_DIR/ASTGTM_N26E114M.img" ]; then
    echo "❌ 未找到数据文件: ASTGTM_N26E114M.img"
    echo "请确保在 public/ 目录下运行此脚本"
    exit 1
fi

# 设置构建目录
BUILD_DIR="$HOME/gdal_ctb_build"
GDAL_VERSION="3.0.4"
# CTB 可能的路径（优先使用用户目录下已安装的）
CTB_SEARCH_PATHS=(
    "$HOME/cesium-terrain-builder"
    "$BUILD_DIR/cesium-terrain-builder"
)
CTB_DIR=""  # 将在检测阶段设置

echo ""
echo "构建目录: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ============================================
# [1/4] 智能检测/安装 GDAL
# ============================================
echo ""
echo "[1/4] 检测 GDAL 安装..."

GDAL_DIR=""
GDAL_FOUND=false

# 可能的 GDAL 安装路径
GDAL_SEARCH_PATHS=(
    "$HOME/gdal-build"
    "$BUILD_DIR/gdal-${GDAL_VERSION}"
    "$BUILD_DIR/gdal_install"
)

# 检查每个路径
for path in "${GDAL_SEARCH_PATHS[@]}"; do
    if [ -f "$path/apps/gdalinfo" ]; then
        GDAL_DIR="$path"
        GDAL_FOUND=true
        echo "✅ 找到 GDAL 安装: $GDAL_DIR"
        "$GDAL_DIR/apps/gdalinfo" --version
        break
    fi
done

# 如果未找到，安装 GDAL
if [ "$GDAL_FOUND" = false ]; then
    echo "⚠️  未找到 GDAL 安装，开始编译安装..."
    GDAL_DIR="$BUILD_DIR/gdal-${GDAL_VERSION}"

    cd "$BUILD_DIR"

    # 下载
    if [ ! -f "gdal-${GDAL_VERSION}.tar.gz" ]; then
        echo "正在从 GitHub 下载 GDAL ${GDAL_VERSION}..."
        wget --progress=bar:force https://github.com/OSGeo/gdal/releases/download/v${GDAL_VERSION}/gdal-${GDAL_VERSION}.tar.gz || {
            echo "❌ GitHub下载失败，尝试备用源..."
            wget --progress=bar:force https://fossies.org/linux/misc/gdal-${GDAL_VERSION}.tar.gz
        }
    fi

    # 解压
    if [ ! -d "gdal-${GDAL_VERSION}" ]; then
        echo "解压 GDAL 源码..."
        tar -xzf gdal-${GDAL_VERSION}.tar.gz
    fi

    cd "$GDAL_DIR"

    # 修复CAD驱动编译错误
    if [ -f "ogr/ogrsf_frmts/cad/libopencad/dwg/r2000.cpp" ]; then
        if ! grep -q "#include <limits>" "ogr/ogrsf_frmts/cad/libopencad/dwg/r2000.cpp"; then
            echo "修复 CAD 驱动编译错误..."
            sed -i '/^#include <cassert>/a #include <limits>' "ogr/ogrsf_frmts/cad/libopencad/dwg/r2000.cpp"
        fi
    fi

    # 配置
    echo "配置 GDAL..."
    ./configure --prefix="$BUILD_DIR/gdal_install" --quiet

    # 编译
    echo "编译 GDAL (这可能需要 5-10 分钟)..."
    make -j$(nproc) --quiet

    echo "✅ GDAL 编译完成"
fi

# ============================================
# [2/4] 智能检测/安装 CTB
# ============================================
echo ""
echo "[2/4] 检测 Cesium Terrain Builder..."

# 先设置 GDAL 库路径，用于测试 CTB
export LD_LIBRARY_PATH="$GDAL_DIR/.libs:$LD_LIBRARY_PATH"

CTB_FOUND=false
CTB_NEED_REBUILD=false

# 检查可能的 CTB 路径
for path in "${CTB_SEARCH_PATHS[@]}"; do
    if [ -f "$path/build/tools/ctb-tile" ]; then
        CTB_DIR="$path"
        CTB_FOUND=true
        echo "✅ 找到 CTB 安装: $CTB_DIR"

        # 测试 CTB 是否能正常运行
        if ! LD_LIBRARY_PATH="$GDAL_DIR/.libs:$LD_LIBRARY_PATH" "$CTB_DIR/build/tools/ctb-tile" --help >/dev/null 2>&1; then
            echo "⚠️  CTB 库版本不匹配，需要重新编译"
            CTB_NEED_REBUILD=true
        fi
        break
    fi
done

# 如果未找到或需要重建，安装/重编译 CTB
if [ "$CTB_FOUND" = false ] || [ "$CTB_NEED_REBUILD" = true ]; then
    if [ "$CTB_NEED_REBUILD" = true ]; then
        echo "🔧 重新编译 CTB 以匹配当前 GDAL..."
        # 清理旧的构建
        rm -rf "$CTB_DIR/build"
    else
        echo "⚠️  未找到 CTB，开始编译安装..."
        CTB_DIR="$BUILD_DIR/cesium-terrain-builder"
    fi

    if [ ! -d "$CTB_DIR" ]; then
        cd "$BUILD_DIR"
        echo "克隆 CTB..."
        git clone --depth 1 https://github.com/geo-data/cesium-terrain-builder.git
    fi

    cd "$CTB_DIR"

    # 先重置任何之前的修改
    if [ -d ".git" ]; then
        git checkout -- CMakeLists.txt src/CMakeLists.txt 2>/dev/null || true
    fi

    # 清理旧的构建目录
    rm -rf build
    mkdir -p build && cd build

    # 修复版本检查 - 设置 HAVE_UNIFIED_GDAL 绕过检查
    if [ -f "../src/CMakeLists.txt" ]; then
        if ! grep -q "HAVE_UNIFIED_GDAL TRUE" "../src/CMakeLists.txt"; then
            echo "修复 CTB GDAL 版本检测..."
            # 在版本检查之前设置 HAVE_UNIFIED_GDAL
            sed -i '/if(NOT MSVC AND NOT HAVE_UNIFIED_GDAL)/i set(HAVE_UNIFIED_GDAL TRUE CACHE INTERNAL "Skip GDAL version check")' ../src/CMakeLists.txt
        fi
    fi

    echo "配置 CTB..."
    cmake .. -DCMAKE_BUILD_TYPE=Release \
        -DGDAL_INCLUDE_DIR="$GDAL_DIR/port" \
        -DGDAL_LIBRARY="$GDAL_DIR/.libs/libgdal.so" \
        -DCMAKE_CXX_FLAGS="-I$GDAL_DIR/port -I$GDAL_DIR/gcore -I$GDAL_DIR/ogr -I$GDAL_DIR/alg" \
        -DCMAKE_C_FLAGS="-I$GDAL_DIR/port -I$GDAL_DIR/gcore"

    echo "编译 CTB..."
    make -j$(nproc) --quiet

    echo "✅ CTB 编译完成"
fi

# 设置环境变量
export GDAL_DATA="$GDAL_DIR/data"
export LD_LIBRARY_PATH="$GDAL_DIR/.libs:$CTB_DIR/build/src:$LD_LIBRARY_PATH"
export PATH="$GDAL_DIR/apps:$CTB_DIR/build/tools:$PATH"

echo ""
echo "📋 工具状态总结:"
echo "  GDAL: $GDAL_DIR"
echo "  CTB:  $CTB_DIR"

# ============================================
# [3/4] 转换数据格式 (IMG -> GeoTIFF)
# ============================================
echo ""
echo "[3/4] 转换数据格式 (IMG -> GeoTIFF)..."
cd "$WORK_DIR"

if [ ! -f "ji_an.tif" ]; then
    echo "正在转换: ASTGTM_N26E114M.img -> ji_an.tif"
    "$GDAL_DIR/apps/gdal_translate" -of GTiff -co COMPRESS=LZW \
        ASTGTM_N26E114M.img ji_an.tif --quiet
    echo "✅ GeoTIFF 创建完成"
else
    echo "✅ GeoTIFF 已存在"
fi

# ============================================
# [4/4] 创建地形瓦片
# ============================================
echo ""
echo "[4/4] 创建地形瓦片..."

mkdir -p terrain_tiles

echo "输入文件: ASTGTM_N26E114M.img"
echo "输出目录: terrain_tiles/"
echo "缩放级别: 0-14"

echo "正在生成地形瓦片 (这可能需要几分钟)..."
"$CTB_DIR/build/tools/ctb-tile" -o terrain_tiles/ -e 0 -s 14 -r bilinear ji_an.tif

# ============================================
# 验证输出
# ============================================
echo ""
echo "[验证] 检查输出..."

if [ -d "terrain_tiles/0" ]; then
    TILE_COUNT=$(find terrain_tiles/ -name "*.terrain" 2>/dev/null | wc -l)
    echo "✅ 地形瓦片已生成"
    echo ""
    echo "目录结构:"
    ls -lh terrain_tiles/ | head -10
    echo ""
    echo "瓦片统计:"
    echo "  - 总瓦片数: $TILE_COUNT"
    echo "  - 缩放级别: 0-14"
    echo ""
    echo "=================================================="
    echo "  ✅ 地形数据处理完成!"
    echo "=================================================="
    echo ""
    echo "📂 地形瓦片位置: $WORK_DIR/terrain_tiles/"
    echo ""
    echo "🔗 在 Cesium 中加载:"
    echo "   const terrainProvider = new Cesium.CesiumTerrainProvider({"
    echo "     url: './terrain_tiles/'"
    echo "   });"
    echo ""
    echo "💾 构建文件保存在: $BUILD_DIR"
    echo "   下次运行将自动检测，无需重新编译"
else
    echo "❌ 地形瓦片生成失败"
    exit 1
fi
