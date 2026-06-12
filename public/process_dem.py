#!/usr/bin/env python3
"""
DEM 数据转换脚本
将 ASTGTM .img 格式转换为 Cesium 可用的地形切片
"""
import os
import subprocess
import sys

def check_dependencies():
    """检查必要的工具是否安装"""
    print("🔍 检查依赖工具...")

    # 检查 GDAL
    try:
        result = subprocess.run(['gdalinfo', '--version'], capture_output=True, text=True)
        print(f"✅ GDAL 已安装: {result.stdout.strip()}")
    except FileNotFoundError:
        print("❌ GDAL 未安装")
        print("\n请运行以下命令安装 GDAL:")
        print("sudo apt update && sudo apt install -y gdal-bin libgdal-dev")
        return False

    # 检查 CTB
    try:
        result = subprocess.run(['ctb-tile', '--help'], capture_output=True, text=True)
        print(f"✅ CTB 已安装")
    except FileNotFoundError:
        print("⚠️  CTB 未安装")
        print("\n请运行安装脚本:")
        print("./install_ctb.sh")
        print("\n或手动安装 CTB:")
        print("sudo apt install -y build-essential git cmake zlib1g-dev libcurl4-openssl-dev")
        return False

    return True

def convert_img_to_geotiff(input_img, output_tif):
    """将 .img 格式转换为 GeoTIFF 格式"""
    print(f"\n📝 转换 {input_img} -> {output_tif}")

    # 使用 GDAL 转换格式
    cmd = [
        'gdal_translate',
        '-of', 'GTiff',
        '-co', 'COMPRESS=LZW',
        input_img,
        output_tif
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"✅ 转换完成: {output_tif}")
        return output_tif
    except subprocess.CalledProcessError as e:
        print(f"❌ 转换失败: {e}")
        return None

def process_terrain_data(input_file, output_dir):
    """处理地形数据：转换格式 + CTB 切片"""

    print("=" * 50)
    print("  DEM 数据处理流程")
    print("=" * 50)

    # 检查输入文件
    if not os.path.exists(input_file):
        print(f"❌ 输入文件不存在: {input_file}")
        return False

    print(f"📁 输入文件: {input_file}")
    print(f"📊 文件大小: {os.path.getsize(input_file) / 1024 / 1024:.1f} MB")

    # 检查依赖
    if not check_dependencies():
        return False

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    print(f"\n📁 输出目录: {output_dir}")

    # 转换为 GeoTIFF
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    tif_file = os.path.join(output_dir, f"{base_name}.tif")

    if not convert_img_to_geotiff(input_file, tif_file):
        return False

    # CTB 切片
    print(f"\n🔪 使用 CTB 切片地形数据...")
    print(f"   输入: {tif_file}")
    print(f"   输出: {output_dir}")
    print(f"   缩放级别: 0-14")

    cmd = [
        'ctb-tile',
        '-f', tif_file,
        '-o', output_dir,
        '--zoom', '0-14',
        '--forceresepect',
        '--overwrite'
    ]

    try:
        subprocess.run(cmd, check=True)
        print(f"\n✅ 地形切片完成!")
        print(f"   输出目录: {output_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ CTB 切片失败: {e}")
        print(f"\n💡 可能的原因:")
        print(f"   1. CTB 未正确安装")
        print(f"   2. 输入文件格式不支持")
        print(f"   3. 磁盘空间不足")
        return False

def main():
    """主函数"""

    print("\n" + "=" * 50)
    print("  Cesium 离线地形数据处理工具")
    print("  适用于江西吉安 ASTGTM 数据")
    print("=" * 50 + "\n")

    # 输入文件
    input_file = "ASTGTM_N26E114M.img"
    output_dir = "terrain_tiles"

    # 检查输入文件
    if not os.path.exists(input_file):
        print(f"❌ 未找到数据文件: {input_file}")
        print(f"\n📁 请确保数据文件在当前目录")
        return

    # 处理数据
    success = process_terrain_data(input_file, output_dir)

    if success:
        print("\n" + "=" * 50)
        print("  ✅ 地形数据处理完成!")
        print("=" * 50)
        print(f"\n📂 地形瓦片位置: {output_dir}/")
        print(f"\n🔗 在 Cesium 中使用:")
        print(f"   const terrainProvider = new Cesium.CesiumTerrainProvider({{")
        print(f"     url: './{output_dir}/'")
        print(f"   }});")
        print("\n")

        # 创建使用说明文件
        with open(f"{output_dir}/README.md", "w") as f:
            f.write(f"""# Cesium 离线地形数据

## 数据来源
- 原始数据: {input_file}
- 处理时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- 数据范围: 江西省吉安市

## 在 Cesium 中加载

```javascript
const viewer = new Cesium.Viewer('cesiumContainer', {{
  terrainProvider: new Cesium.CesiumTerrainProvider({{
    url: './{output_dir}/'
  }})
}});
```

## 目录结构
```
{output_dir}/
├── 0/
├── 1/
├── 2/
├── ...
└── 14/
```

每个子目录包含对应缩放级别的地形瓦片。

## 说明
- 缩放级别 0-14 对应 Cesium 的 zoom level
- 数据格式: Quantized-Mesh (.terrain)
- 坐标系: WGS84

## 更新 LayerControl.vue

将 `tryCesiumIonTerrain` 方法中的 URL 改为本地路径:

```javascript
const localTerrain = new Cesium.CesiumTerrainProvider({{
  url: './{output_dir}/',
  requestWaterMask: false,
  requestVertexNormals: false
}});

this.cesiumViewer.terrainProvider = localTerrain;
```
""")
        print(f"✅ 使用说明已创建: {output_dir}/README.md")
    else:
        print("\n" + "=" * 50)
        print("  ❌ 处理失败")
        print("=" * 50)
        print("\n💡 请检查:")
        print("   1. 是否已安装 GDAL: sudo apt install -y gdal-bin")
        print("   2. 是否已安装 CTB: ./install_ctb.sh")
        print("   3. 输入文件格式是否正确")

if __name__ == "__main__":
    main()
