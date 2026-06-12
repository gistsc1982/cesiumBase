// ═══════════════════════════════════════════════════════════════════
// 多场景管理器 - 分层 Near/Far 实现
// ═══════════════════════════════════════════════════════════════════
// 功能：在一个canvas内使用多个场景+相机，实现分层 near/far
// 架构：
//   - 原始层：Scene1_Large (大坐标) + Scene1_Small (小坐标)
//   - BIM层：Scene2_Large (大坐标) + Scene2_Small (小坐标)
//   - 每层使用两个场景累积渲染，共享同一个渲染器
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // 配置常量
  // ═══════════════════════════════════════════════════════════════════
  const CONFIG = {
    // 大坐标阈值（超过此值视为大坐标模型）
    LARGE_COORD_THRESHOLD: 10000,

    // 大坐标场景的 near/far
    LARGE_SCENE_NEAR: 0.1,
    LARGE_SCENE_FAR: 15000000,

    // 小坐标场景的 near/far
    SMALL_SCENE_NEAR: 36,
    SMALL_SCENE_FAR: 1802,

    // 是否启用对数深度缓冲区
    LARGE_SCENE_LOG_DEPTH: true,
    SMALL_SCENE_LOG_DEPTH: false
  };

  // ═══════════════════════════════════════════════════════════════════
  // 从 DualCanvasViewer 中提取 THREE 库
  // ═══════════════════════════════════════════════════════════════════
  function extractTHREE(dualViewer) {
    // 方法1: 从 dualViewer.THREE 获取
    if (dualViewer.THREE) {
      console.log('  ✅ THREE 库来源: dualViewer.THREE');
      return dualViewer.THREE;
    }

    // 方法2: 从 window.THREE 获取
    if (window.THREE) {
      console.log('  ✅ THREE 库来源: window.THREE');
      return window.THREE;
    }

    // 方法3: 从渲染器构造函数获取
    if (dualViewer.renderer1 && dualViewer.renderer1.constructor) {
      const RendererConstructor = dualViewer.renderer1.constructor;
      // 检查是否有 THREE 命名空间
      if (RendererConstructor.name === 'WebGLRenderer') {
        // 尝试从全局查找
        if (typeof THREE !== 'undefined') {
          console.log('  ✅ THREE 库来源: global THREE');
          return THREE;
        }
      }
    }

    // 方法4: 从相机构造函数获取
    if (dualViewer.camera1 && dualViewer.camera1.constructor) {
      const CameraConstructor = dualViewer.camera1.constructor;
      // 检查原型链上是否有 THREE
      if (CameraConstructor.prototype && CameraConstructor.prototype.constructor) {
        const THREE = CameraConstructor.prototype.constructor.THREE || CameraConstructor.THREE;
        if (THREE) {
          console.log('  ✅ THREE 库来源: camera constructor');
          return THREE;
        }
      }
    }

    // 方法5: 尝试从场景构造函数获取
    if (dualViewer.scene1 && dualViewer.scene1.constructor) {
      const SceneConstructor = dualViewer.scene1.constructor;
      const THREE = SceneConstructor.THREE || SceneConstructor.prototype?.constructor?.THREE;
      if (THREE) {
        console.log('  ✅ THREE 库来源: scene constructor');
        return THREE;
      }
    }

    // 方法6: 尝试通过遍历全局对象找到 THREE
    // 检查常见的 THREE 全局变量位置
    if (typeof window !== 'undefined') {
      // 检查是否有 __THREE__ 或其他内部变量
      const possibleKeys = ['__THREE__', 'THREE', 'three', 'Three'];
      for (const key of possibleKeys) {
        if (window[key] && window[key].Scene) {
          console.log(`  ✅ THREE 库来源: window.${key}`);
          return window[key];
        }
      }
    }

    // 方法7: 通过现有对象的构造函数名称和特征来识别 THREE
    if (dualViewer.scene1) {
      const scene = dualViewer.scene1;
      // 检查 scene 是否有 THREE 特征的方法
      if (scene.add && scene.remove && scene.children && typeof scene.add === 'function') {
        // 这是一个 THREE.Scene 对象，尝试通过其构造函数查找 THREE
        try {
          const SceneConstructor = scene.constructor;
          // 创建一个测试对象来获取 THREE 引用
          if (SceneConstructor) {
            // 通过对象的原型链向上查找
            let proto = SceneConstructor.prototype;
            while (proto) {
              if (proto.constructor && proto.constructor.name) {
                // 找到了构造函数，现在尝试找到 THREE 命名空间
                // 由于这是打包后的代码，THREE 可能不是全局的
                // 我们标记为使用构造函数模式
                console.log('  ℹ️ THREE 库未直接找到，将使用构造函数模式');
                return null;
              }
              proto = Object.getPrototypeOf(proto);
            }
          }
        } catch (e) {
          // 忽略错误
        }
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 多场景管理器类
  // ═══════════════════════════════════════════════════════════════════
  class MultiSceneManager {
    constructor(dualViewer) {
      this.dualViewer = dualViewer;
      this.scenes = {};
      this.cameras = {};
      this.renderTargets = {};
      this.referencePoints = {
        layer1: null,  // 原始层的参考点（大模型位置）
        layer2: null   // BIM层的参考点（大模型位置）
      };

      // 获取 THREE 库
      this.THREE = extractTHREE(dualViewer);

      if (!this.THREE) {
        console.log('  ℹ️ THREE 库未直接找到，将使用构造函数模式初始化');
        console.log('     (这是正常的，系统会自动使用现有对象的构造函数)');
      } else {
        console.log('  ✅ THREE 库已找到');
      }

      console.log('🎬 MultiSceneManager 初始化...');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 初始化多场景架构
    // ═══════════════════════════════════════════════════════════════════
    initialize() {
      console.log('\n🏗️ 初始化多场景架构...');

      // 检查 THREE 库是否可用
      if (!this.THREE) {
        console.log('  🔧 使用构造函数模式初始化...');
        if (!this.initializeUsingConstructors()) {
          console.error('❌ 构造函数模式初始化失败');
          return false;
        }
      } else {
        console.log('  🔧 使用 THREE 库模式初始化...');
        if (!this.initializeUsingTHREE()) {
          console.error('❌ THREE 库模式初始化失败');
          return false;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 分类并移动模型
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔄 分类并移动模型到对应场景...');
      this.classifyAndMoveModels();

      // ═══════════════════════════════════════════════════════════════
      // 修改渲染器设置
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🎨 修改渲染器设置...');
      this.setupRenderers();

      // ═══════════════════════════════════════════════════════════════
      // 替换渲染循环
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔄 替换渲染循环...');
      this.replaceRenderLoops();

      // ═══════════════════════════════════════════════════════════════
      // 设置相机同步
      // ═══════════════════════════════════════════════════════════════
      console.log('\n🔗 设置相机同步...');
      this.setupCameraSync();

      // ═══════════════════════════════════════════════════════════════
      // 更新 DualCanvasViewer 的引用
      // ═══════════════════════════════════════════════════════════════
      this.dualViewer.multiSceneManager = this;
      this.dualViewer.scene1 = this.scenes.layer1Large;
      this.dualViewer.scene2 = this.scenes.layer2Large;

      console.log('\n✅ 多场景架构初始化完成！');
      return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 使用 THREE 库初始化
    // ═══════════════════════════════════════════════════════════════════
    initializeUsingTHREE() {
      const THREE = this.THREE;  // 使用局部变量方便后续调用

      // 保存原始场景和相机
      const originalScene1 = this.dualViewer.scene1;
      const originalScene2 = this.dualViewer.scene2;
      const originalCamera1 = this.dualViewer.camera1;
      const originalCamera2 = this.dualViewer.camera2;

      // ═══════════════════════════════════════════════════════════════
      // 创建原始层的两个场景
      // ═══════════════════════════════════════════════════════════════
      console.log('  📦 创建原始层场景...');

      this.scenes.layer1Large = new THREE.Scene();
      this.scenes.layer1Small = new THREE.Scene();

      // 复制原始场景的属性
      this.scenes.layer1Large.background = originalScene1.background;
      this.scenes.layer1Small.background = originalScene1.background;

      if (originalScene1.fog) {
        this.scenes.layer1Large.fog = originalScene1.fog.clone();
        this.scenes.layer1Small.fog = originalScene1.fog.clone();
      }

      // 复制光源到新场景
      originalScene1.traverse(obj => {
        if (obj.isLight) {
          const light = obj.clone();
          this.scenes.layer1Large.add(light);
          this.scenes.layer1Small.add(light.clone());
        }
      });

      // ═══════════════════════════════════════════════════════════════
      // 创建BIM层的两个场景
      // ═══════════════════════════════════════════════════════════════
      console.log('  📦 创建BIM层场景...');

      this.scenes.layer2Large = new THREE.Scene();
      this.scenes.layer2Small = new THREE.Scene();

      // 复制原始场景的属性
      this.scenes.layer2Large.background = originalScene2.background;
      this.scenes.layer2Small.background = originalScene2.background;

      if (originalScene2.fog) {
        this.scenes.layer2Large.fog = originalScene2.fog.clone();
        this.scenes.layer2Small.fog = originalScene2.fog.clone();
      }

      // 复制光源到新场景
      if (originalScene2) {
        originalScene2.traverse(obj => {
          if (obj.isLight) {
            const light = obj.clone();
            this.scenes.layer2Large.add(light);
            this.scenes.layer2Small.add(light.clone());
          }
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 创建四个相机（基于原始相机）
      // ═══════════════════════════════════════════════════════════════
      console.log('  📷 创建分层相机...');

      const fov = originalCamera1.fov * (180 / Math.PI);
      const aspect = originalCamera1.aspect;

      // 原始层相机
      this.cameras.layer1Large = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer1Small = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      // BIM层相机
      this.cameras.layer2Large = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer2Small = new THREE.PerspectiveCamera(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      console.log(`    ✅ 原始层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ 原始层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);
      console.log(`    ✅ BIM层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ BIM层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);

      return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 使用构造函数初始化（当 THREE 库不可用时）
    // ═══════════════════════════════════════════════════════════════════
    initializeUsingConstructors() {
      console.log('  🔧 使用构造函数方法初始化...');

      const originalScene1 = this.dualViewer.scene1;
      const originalScene2 = this.dualViewer.scene2;
      const originalCamera1 = this.dualViewer.camera1;
      const originalCamera2 = this.dualViewer.camera2;

      if (!originalScene1 || !originalCamera1) {
        console.error('❌ 无法获取原始场景或相机');
        return false;
      }

      // 获取构造函数
      const SceneConstructor = originalScene1.constructor;
      const CameraConstructor = originalCamera1.constructor;

      if (!SceneConstructor || !CameraConstructor) {
        console.error('❌ 无法获取场景或相机构造函数');
        return false;
      }

      console.log('  📦 创建场景...');

      // 创建场景
      this.scenes.layer1Large = new SceneConstructor();
      this.scenes.layer1Small = new SceneConstructor();

      this.scenes.layer1Large.background = originalScene1.background;
      this.scenes.layer1Small.background = originalScene1.background;

      if (originalScene1.fog) {
        this.scenes.layer1Large.fog = originalScene1.fog.clone();
        this.scenes.layer1Small.fog = originalScene1.fog.clone();
      }

      // 复制光源到新场景
      originalScene1.traverse(obj => {
        if (obj.isLight) {
          const light = obj.clone();
          this.scenes.layer1Large.add(light);
          this.scenes.layer1Small.add(light.clone());
        }
      });

      this.scenes.layer2Large = new SceneConstructor();
      this.scenes.layer2Small = new SceneConstructor();

      if (originalScene2) {
        this.scenes.layer2Large.background = originalScene2.background;
        this.scenes.layer2Small.background = originalScene2.background;

        if (originalScene2.fog) {
          this.scenes.layer2Large.fog = originalScene2.fog.clone();
          this.scenes.layer2Small.fog = originalScene2.fog.clone();
        }

        // 复制光源到新场景
        originalScene2.traverse(obj => {
          if (obj.isLight) {
            const light = obj.clone();
            this.scenes.layer2Large.add(light);
            this.scenes.layer2Small.add(light.clone());
          }
        });
      }

      console.log('  📷 创建相机...');

      const fov = originalCamera1.fov * (180 / Math.PI);
      const aspect = originalCamera1.aspect;

      // 创建相机
      this.cameras.layer1Large = new CameraConstructor(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer1Small = new CameraConstructor(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      this.cameras.layer2Large = new CameraConstructor(
        fov, aspect,
        CONFIG.LARGE_SCENE_NEAR,
        CONFIG.LARGE_SCENE_FAR
      );

      this.cameras.layer2Small = new CameraConstructor(
        fov, aspect,
        CONFIG.SMALL_SCENE_NEAR,
        CONFIG.SMALL_SCENE_FAR
      );

      console.log(`    ✅ 原始层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ 原始层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);
      console.log(`    ✅ BIM层大坐标: near=${CONFIG.LARGE_SCENE_NEAR}, far=${CONFIG.LARGE_SCENE_FAR}`);
      console.log(`    ✅ BIM层小坐标: near=${CONFIG.SMALL_SCENE_NEAR}, far=${CONFIG.SMALL_SCENE_FAR}`);

      return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 分类并移动模型
    // ═══════════════════════════════════════════════════════════════════
    classifyAndMoveModels() {
      // ═══════════════════════════════════════════════════════════════
      // 处理原始层模型
      // ═══════════════════════════════════════════════════════════════
      const models1 = this.dualViewer.modelGroup1?.children.filter(m => !m.userData.isBox3Helper) || [];
      console.log(`\n  📦 原始层模型数量: ${models1.length}`);

      const layer1LargeModels = [];
      const layer1SmallModels = [];

      models1.forEach(model => {
        const pos = model.position;
        const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                       Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;

        if (isLarge) {
          layer1LargeModels.push(model);
        } else {
          layer1SmallModels.push(model);
        }
      });

      console.log(`    - 大坐标模型: ${layer1LargeModels.length} 个`);
      console.log(`    - 小坐标模型: ${layer1SmallModels.length} 个`);

      // 计算参考点（使用第一个大模型的位置）
      if (layer1LargeModels.length > 0) {
        const refModel = layer1LargeModels[0];
        this.referencePoints.layer1 = refModel.position.clone();
        console.log(`    📍 原始层参考点: (${this.referencePoints.layer1.x.toFixed(2)}, ${this.referencePoints.layer1.y.toFixed(2)}, ${this.referencePoints.layer1.z.toFixed(2)})`);

        // 大坐标模型直接添加到场景
        layer1LargeModels.forEach(model => {
          this.scenes.layer1Large.add(model);
        });

        // 小坐标模型转换为相对坐标
        layer1SmallModels.forEach(model => {
          const relativePos = model.position.clone().sub(this.referencePoints.layer1);
          model.position.copy(relativePos);
          model.userData.isRelativeCoordinate = true;
          model.userData.originalPosition = model.position.clone();
          this.scenes.layer1Small.add(model);
        });
      } else {
        // 没有大模型，所有模型使用小坐标场景
        console.log('    ⚠️ 没有找到大坐标模型，所有模型使用小坐标场景');
        layer1SmallModels.forEach(model => {
          this.scenes.layer1Small.add(model);
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // 处理BIM层模型
      // ═══════════════════════════════════════════════════════════════
      const models2 = this.dualViewer.modelGroup2?.children.filter(m => !m.userData.isBox3Helper) || [];
      console.log(`\n  📦 BIM层模型数量: ${models2.length}`);

      const layer2LargeModels = [];
      const layer2SmallModels = [];

      models2.forEach(model => {
        const pos = model.position;
        const isLarge = Math.abs(pos.x) > CONFIG.LARGE_COORD_THRESHOLD ||
                       Math.abs(pos.z) > CONFIG.LARGE_COORD_THRESHOLD;

        if (isLarge) {
          layer2LargeModels.push(model);
        } else {
          layer2SmallModels.push(model);
        }
      });

      console.log(`    - 大坐标模型: ${layer2LargeModels.length} 个`);
      console.log(`    - 小坐标模型: ${layer2SmallModels.length} 个`);

      // 计算参考点
      if (layer2LargeModels.length > 0) {
        const refModel = layer2LargeModels[0];
        this.referencePoints.layer2 = refModel.position.clone();
        console.log(`    📍 BIM层参考点: (${this.referencePoints.layer2.x.toFixed(2)}, ${this.referencePoints.layer2.y.toFixed(2)}, ${this.referencePoints.layer2.z.toFixed(2)})`);

        layer2LargeModels.forEach(model => {
          this.scenes.layer2Large.add(model);
        });

        layer2SmallModels.forEach(model => {
          const relativePos = model.position.clone().sub(this.referencePoints.layer2);
          model.position.copy(relativePos);
          model.userData.isRelativeCoordinate = true;
          model.userData.originalPosition = model.position.clone();
          this.scenes.layer2Small.add(model);
        });
      } else {
        console.log('    ⚠️ 没有找到大坐标模型，所有模型使用小坐标场景');
        layer2SmallModels.forEach(model => {
          this.scenes.layer2Small.add(model);
        });
      }

      // 清空原始模型组
      if (this.dualViewer.modelGroup1) {
        this.dualViewer.modelGroup1.clear();
      }
      if (this.dualViewer.modelGroup2) {
        this.dualViewer.modelGroup2.clear();
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 设置渲染器
    // ═══════════════════════════════════════════════════════════════════
    setupRenderers() {
      // 原始层渲染器
      if (this.dualViewer.renderer1) {
        this.dualViewer.renderer1.autoClear = false;
        console.log('    ✅ 原始层渲染器已设置 autoClear = false');
      }

      // BIM层渲染器
      if (this.dualViewer.renderer2) {
        this.dualViewer.renderer2.autoClear = false;
        console.log('    ✅ BIM层渲染器已设置 autoClear = false');
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 更新所有场景中的动画混合器
    // ═══════════════════════════════════════════════════════════════════
    updateAnimations(delta) {
      const allScenes = [
        this.scenes.layer1Large,
        this.scenes.layer1Small,
        this.scenes.layer2Large,
        this.scenes.layer2Small
      ];
      allScenes.forEach(scene => {
        scene.traverse(obj => {
          if (obj.userData && obj.userData.animationMixer) {
            obj.userData.animationMixer.update(delta);
          }
        });
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 替换渲染循环
    // ═══════════════════════════════════════════════════════════════════
    replaceRenderLoops() {
      const self = this;

      // 创建时钟
      let lastTime = performance.now() / 1000;

      // 停止原始渲染循环
      if (this.dualViewer.animationFrame1) {
        cancelAnimationFrame(this.dualViewer.animationFrame1);
      }
      if (this.dualViewer.animationFrame2) {
        cancelAnimationFrame(this.dualViewer.animationFrame2);
      }

      // ═══════════════════════════════════════════════════════════════
      // 原始层渲染循环
      // ═══════════════════════════════════════════════════════════════
      const animate1 = () => {
        this.dualViewer.animationFrame1 = requestAnimationFrame(animate1);

        // 计算 delta 时间并更新动画
        const now = performance.now() / 1000;
        const delta = Math.min(now - lastTime, 0.1); // 限制最大 delta
        lastTime = now;
        self.updateAnimations(delta);

        // 更新控制器
        if (this.dualViewer.controls1) {
          this.dualViewer.controls1.update();
        }

        // 同步所有相机
        self.syncCameras();

        // 渲染原始层（使用已有的 renderer1）
        self.renderLayer1();
      };

      // ═══════════════════════════════════════════════════════════════
      // BIM层渲染循环
      // ═══════════════════════════════════════════════════════════════
      const animate2 = () => {
        this.dualViewer.animationFrame2 = requestAnimationFrame(animate2);

        // 更新控制器
        if (this.dualViewer.controls2) {
          this.dualViewer.controls2.update();
        }

        // 渲染BIM层
        self.renderLayer2();
      };

      animate1();
      animate2();

      console.log('    ✅ 渲染循环已替换（包含动画更新）');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 渲染原始层
    // ═══════════════════════════════════════════════════════════════════
    renderLayer1() {
      const renderer = this.dualViewer.renderer1;
      if (!renderer) return;

      // 清除颜色缓冲区
      renderer.clear(true, true, false);

      // 渲染大坐标场景
      if (this.scenes.layer1Large.children.length > 0) {
        renderer.render(this.scenes.layer1Large, this.cameras.layer1Large);
      }

      // 渲染小坐标场景（不清除颜色，只清除深度）
      if (this.scenes.layer1Small.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer1Small, this.cameras.layer1Small);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 渲染BIM层
    // ═══════════════════════════════════════════════════════════════════
    renderLayer2() {
      const renderer = this.dualViewer.renderer2;
      if (!renderer) return;

      // 清除颜色缓冲区
      renderer.clear(true, true, false);

      // 渲染大坐标场景
      if (this.scenes.layer2Large.children.length > 0) {
        renderer.render(this.scenes.layer2Large, this.cameras.layer2Large);
      }

      // 渲染小坐标场景
      if (this.scenes.layer2Small.children.length > 0) {
        renderer.clearDepth();
        renderer.render(this.scenes.layer2Small, this.cameras.layer2Small);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 同步所有相机
    // ═══════════════════════════════════════════════════════════════════
    syncCameras() {
      const baseCamera = this.dualViewer.camera1 || this.cameras.layer1Large;

      // 同步原始层相机
      this.syncCamera(baseCamera, this.cameras.layer1Large, this.referencePoints.layer1, true);
      this.syncCamera(baseCamera, this.cameras.layer1Small, this.referencePoints.layer1, false);

      // 同步BIM层相机
      this.syncCamera(baseCamera, this.cameras.layer2Large, this.referencePoints.layer2, true);
      this.syncCamera(baseCamera, this.cameras.layer2Small, this.referencePoints.layer2, false);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 同步单个相机
    // ═══════════════════════════════════════════════════════════════════
    syncCamera(baseCamera, targetCamera, referencePoint, isLargeScene) {
      // 同步位置和旋转
      if (isLargeScene || !referencePoint) {
        // 大坐标场景：直接使用基准相机位置
        targetCamera.position.copy(baseCamera.position);
        targetCamera.quaternion.copy(baseCamera.quaternion);
      } else {
        // 小坐标场景：转换为相对坐标
        const relativePos = baseCamera.position.clone().sub(referencePoint);
        targetCamera.position.copy(relativePos);
        targetCamera.quaternion.copy(baseCamera.quaternion);
      }

      // 同步缩放和其他属性
      targetCamera.zoom = baseCamera.zoom;
      targetCamera.aspect = baseCamera.aspect;

      targetCamera.updateProjectionMatrix();
    }

    // ═══════════════════════════════════════════════════════════════════
    // 设置相机同步
    // ═══════════════════════════════════════════════════════════════════
    setupCameraSync() {
      // 监听控制器变化
      if (this.dualViewer.controls1) {
        this.dualViewer.controls1.addEventListener('change', () => {
          this.syncCameras();
        });
      }

      if (this.dualViewer.controls2) {
        this.dualViewer.controls2.addEventListener('change', () => {
          this.syncCameras();
        });
      }

      console.log('    ✅ 相机同步已设置');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 调试信息
    // ═══════════════════════════════════════════════════════════════════
    getDebugInfo() {
      return {
        scenes: {
          layer1Large: this.scenes.layer1Large.children.length,
          layer1Small: this.scenes.layer1Small.children.length,
          layer2Large: this.scenes.layer2Large.children.length,
          layer2Small: this.scenes.layer2Small.children.length
        },
        cameras: {
          layer1Large: {
            near: this.cameras.layer1Large.near,
            far: this.cameras.layer1Large.far
          },
          layer1Small: {
            near: this.cameras.layer1Small.near,
            far: this.cameras.layer1Small.far
          },
          layer2Large: {
            near: this.cameras.layer2Large.near,
            far: this.cameras.layer2Large.far
          },
          layer2Small: {
            near: this.cameras.layer2Small.near,
            far: this.cameras.layer2Small.far
          }
        },
        referencePoints: this.referencePoints
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 暴露到全局
  // ═══════════════════════════════════════════════════════════════════
  window.MultiSceneManager = MultiSceneManager;
  window.MULTI_SCENE_CONFIG = CONFIG;

  console.log('\n✅ 多场景管理器已加载');
  console.log('📌 使用方法:');
  console.log('   const manager = new MultiSceneManager(window.__dualCanvasViewer);');
  console.log('   manager.initialize();');

})();
