#!/bin/bash
# GDAL 安装脚本 - 使用 conda 或系统包

set -e

echo "=================================================="
echo "  GDAL 安装脚本"
echo "=================================================="

# 方法1: 使用 Miniconda (推荐)
echo ""
echo "[方法 1] 使用 Miniconda 安装 GDAL..."

if ! command -v conda &> /dev/null; then
    echo "Conda 未安装，正在下载 Miniconda..."

    # 下载 Miniconda
    cd /tmp
    wget --progress=bar:force https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh

    echo "安装 Miniconda..."
    bash miniconda.sh -b -p $HOME/miniconda3

    # 初始化 conda
    $HOME/miniconda3/bin/conda init bash

    echo "✅ Miniconda 安装完成"
    echo "请运行: source ~/.bashrc"
    echo "然后重新运行此脚本"
    exit 0
fi

# 创建环境并安装 GDAL
echo "创建 ctb 环境并安装 GDAL..."
conda create -n ctb -y gdal=3.0 || conda install -n ctb -y gdal=3.0

echo ""
echo "=================================================="
echo "  ✅ GDAL 安装完成！"
echo "=================================================="
echo ""
echo "使用方法："
echo "  激活环境: conda activate ctb"
echo "  验证安装: gdalinfo --version"
echo ""
