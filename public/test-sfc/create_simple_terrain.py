#!/usr/bin/env python3
"""
创建简单的测试地形数据
用于 Cesium 离线地形测试
"""
import json
import math
import zlib

def create_simple_terrain():
    """创建一个小的测试地形数据（模拟山区地形）"""

    # 创建一个 16x16 的简单高程数据（模拟山脉）
    size = 16
    heights = []

    # 创建一个中心隆起的地形（模拟山丘）
    center_x = size // 2
    center_y = size // 2
    max_height = 500  # 最大高度 500 米

    for y in range(size):
        for x in range(size):
            # 计算距离中心的距离
            dx = x - center_x
            dy = y - center_y
            distance = math.sqrt(dx*dx + dy*dy)
            max_dist = math.sqrt(center_x*center_x + center_y*center_y)

            # 创建隆起地形（使用高斯函数模拟）
            if distance < max_dist:
                # 高斯曲线形状
                height = max_height * math.exp(-(distance**2) / (2 * (max_dist/3)**2))
                heights.append(int(height))
            else:
                heights.append(0)

    # 创建简单的元数据
    metadata = {
        "tileformatversion": 1,
        "tilenumber": 0,
        "tilewidth": size,
        "tileheight": size,
        "minimumheight": min(heights),
        "maximumheight": max(heights),
        "boundingbox": {
            "west": -180,
            "south": -85,
            "east": -175,
            "north": -80
        }
    }

    # 保存地形数据
    output_dir = "terrain"
    import os
    os.makedirs(output_dir, exist_ok=True)

    # 保存元数据
    with open(f"{output_dir}/metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # 保存高程数据
    with open(f"{output_dir}/heights.txt", "w") as f:
        f.write(" ".join(map(str, heights)))

    print(f"✅ 测试地形数据已创建在 {output_dir}/ 目录")
    print(f"   - 元数据: {output_dir}/metadata.json")
    print(f"   - 高程数据: {output_dir}/heights.txt")
    print(f"   - 最大高度: {max(heights)} 米")
    print(f"   - 数据点数: {len(heights)}")

    # 生成使用说明
    readme = """# Cesium 测试地形数据

这是一个简单的测试地形数据，用于验证 Cesium 地形加载功能。

## 数据说明
- 格式: 16x16 高程网格
- 最大高度: 500 米
- 模拟: 简单的山丘地形

## 在 Cesium 中使用
这个数据需要先转换成 Cesium 支持的格式（.terrain）。
推荐使用以下工具之一：
1. CesiumLab (Windows/Linux) - http://m.cesiumlab.com/
2. gdal2cesium (Python) - pip install gdal2cesium
3. CTB (Cesium Terrain Builder) - https://github.com/geo-data/cesium-terrain-builder

## 快速测试
如需快速测试地形功能，建议直接使用在线服务：
- MapTiler 免费地形: https://www.maptiler.com/
- Cesium ion 示例地形: https://cesium.com/ion
"""

    with open(f"{output_dir}/README.md", "w") as f:
        f.write(readme)

    print(f"   - 使用说明: {output_dir}/README.md")

if __name__ == "__main__":
    create_simple_terrain()
