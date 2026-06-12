import * as THREE from 'three';

// 使用模块作用域内的变量来保存状态，避免 `this` 上下文问题
let canvas;
let renderer;
let scenes = [];
let animationFrameId;
let resourceCheckInterval;

// 保存场景的原始材质状态，用于透明度切换
const sceneMaterialStates = new WeakMap();

/**
 * 安全地检查是否在开发模式
 * 避免使用 process.env.NODE_ENV，因为它在浏览器中不存在
 * @returns {boolean} 是否在开发模式
 */
function isDevelopmentMode() {
    // 方法1：检查 localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
        const devMode = localStorage.getItem('devMode');
        if (devMode === 'true') return true;
        if (devMode === 'false') return false;
    }

    // 方法2：检查 hostname（localhost、127.0.0.1、IP地址视为开发环境）
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        // localhost、127.0.0.1、或者不以点开头的hostname（如本地网络IP）
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               !hostname.includes('.');
    }

    // 默认返回 false（生产模式）
    return false;
}

function animate() {
    // 循环由管理器控制，在函数末尾再次调用
    animationFrameId = requestAnimationFrame(animate);

    if (!renderer || !canvas) {
        return;
    }

    // 确保渲染器尺寸与画布显示尺寸一致，这对于高DPI和响应式布局很重要
    const dpr = window.devicePixelRatio;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) {
        renderer.setSize(displayWidth, displayHeight, false);
    }

    // ✅ 混合显示模式：容器重叠时启用透明度混合
    const canvasRect = canvas.getBoundingClientRect();
    const hasOverlappingContainers = scenes.length > 1 && scenes.some((s, i) => {
        if (!s.element) return false;
        for (let j = i + 1; j < scenes.length; j++) {
            if (!scenes[j].element) continue;
            const rect1 = s.element.getBoundingClientRect();
            const rect2 = scenes[j].element.getBoundingClientRect();
            const overlap = !(rect1.right < rect2.left ||
                              rect1.left > rect2.right ||
                              rect1.bottom < rect2.top ||
                              rect1.top > rect2.bottom);
            if (overlap) return true;
        }
        return false;
    });

    // ✅ 混合显示模式：禁用 scissor test，使用透明度混合
    renderer.setScissorTest(false);

    // ✅ 每帧开始时清除颜色缓冲区（不清除深度）
    // 深度缓冲区会在不透明场景渲染前清除
    renderer.clear(true, false, false);

    // ⚠️ 关键修复：每帧检查并保护大坐标模式下的相机位置
    // 防止相机被错误地设置回小坐标位置
    if (typeof window !== 'undefined' && window.__dualCanvasViewer) {
        const dualViewer = window.__dualCanvasViewer;
        if (dualViewer && typeof dualViewer.protectLargeCoordCameraPosition === 'function') {
            dualViewer.protectLargeCoordCameraPosition();
        }
    }

    // 添加调试：每30帧输出一次状态
    if (!animate.frameCount) animate.frameCount = 0;
    animate.frameCount++;

    // 调试：仅在开发模式下输出，且大幅降低频率（每6000帧 = 约100秒）
    if (isDevelopmentMode() && animate.frameCount % 6000 === 0) {
        console.log('[rendererManager] 渲染循环调试信息:', {
            frameCount: animate.frameCount,
            sceneCount: scenes.length,
            scenes: scenes.map((s, i) => {
                // 检查容器元素的可见性
                let elementInfo = null;
                if (s.element) {
                    const rect = s.element.getBoundingClientRect();
                    const style = window.getComputedStyle(s.element);
                    elementInfo = {
                        rect: `top:${rect.top.toFixed(0)} left:${rect.left.toFixed(0)} w:${rect.width.toFixed(0)} h:${rect.height.toFixed(0)}`,
                        display: style.display,
                        visibility: style.visibility,
                        opacity: style.opacity,
                        zIndex: style.zIndex,
                        pointerEvents: style.pointerEvents,
                        inViewport: rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
                    };
                }

                return {
                    index: i,
                    opacity: s.opacity ?? 1.0,
                    isTransparent: (s.opacity ?? 1.0) < 1.0,
                    hasScene: !!s.scene,
                    objectCount: s.scene ? s.scene.children.length : 0,
                    cameraNear: s.camera ? s.camera.near : null,
                    cameraFar: s.camera ? s.camera.far : null,
                    cameraPos: s.camera ? `(${s.camera.position.x.toFixed(0)}, ${s.camera.position.y.toFixed(0)}, ${s.camera.position.z.toFixed(0)})` : null,
                    visibleMeshes: s.scene ? s.scene.children.filter(c => c.visible && c.type === 'Mesh').length : 0,
                    element: elementInfo
                };
            })
        });
    }

    // ✅ 混合显示：按顺序渲染场景（Layer 1 先渲染，Layer 2 后渲染）
    // 不透明场景先渲染，透明场景后渲染
    const sortedScenes = [...scenes].sort((a, b) => {
        const aOpacity = a.opacity ?? 1.0;
        const bOpacity = b.opacity ?? 1.0;
        return bOpacity - aOpacity; // 不透明（1.0）在前，透明在后
    });

    sortedScenes.forEach((sceneInfo, sortedIndex) => {
        const { element, scene, camera, controls, animationUpdate, opacity } = sceneInfo;
        if (!element) return;

        // 更新动画（如果有动画更新回调）
        if (animationUpdate) {
            animationUpdate();
        }

        const rect = element.getBoundingClientRect();

        // 检查元素是否在视口内可见
        const isVisible =
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth;

        if (!isVisible) {
            return; // 如果元素在屏幕外，则跳过渲染
        }

        // 计算容器与 canvas 的交集
        const intersection = {
            left: Math.max(rect.left, canvasRect.left),
            right: Math.min(rect.right, canvasRect.right),
            top: Math.max(rect.top, canvasRect.top),
            bottom: Math.min(rect.bottom, canvasRect.bottom),
        };

        const width = intersection.right - intersection.left;
        const height = intersection.bottom - intersection.top;

        if (width <= 0 || height <= 0) {
            return; // 如果没有可见区域，则跳过
        }

        // 🔍 调试：仅在开发模式下输出，且大幅降低频率（每6000帧 = 约100秒）
        if (isDevelopmentMode() && animate.frameCount % 6000 === 0) {
            console.log(`[rendererManager] 场景 ${sortedIndex} 渲染信息:`, {
                elementClass: element.className,
                elementRect: `top:${rect.top.toFixed(0)} left:${rect.left.toFixed(0)} w:${rect.width.toFixed(0)} h:${rect.height.toFixed(0)}`,
                viewport: `x:${vpLeft.toFixed(0)} y:${vpBottom.toFixed(0)} w:${vpWidth.toFixed(0)} h:${vpHeight.toFixed(0)}`,
                sceneName: scene.name || 'unnamed',
                sceneChildren: scene.children.length,
                modelGroupChildren: scene.children.filter(c => c.type === 'Group' && c.name && c.name.includes('modelGroup')).map(g => ({ name: g.name, children: g.children.length })),
                opacity: sceneOpacity,
                isTransparent: isTransparent
            });
        }

        // 将 CSS 坐标转换为 WebGL 的剪裁坐标 (左下角为原点)
        const vpLeft = (intersection.left - canvasRect.left) * dpr;
        const vpBottom = (canvasRect.bottom - intersection.bottom) * dpr;
        const vpWidth = width * dpr;
        const vpHeight = height * dpr;

        // 设置视口为容器的位置（支持混合显示）
        renderer.setViewport(vpLeft, vpBottom, vpWidth, vpHeight);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        if (controls) {
            controls.update();
        }

        // ✅ 混合显示：应用透明度设置
        const sceneOpacity = opacity ?? 1.0;
        const isTransparent = sceneOpacity < 1.0;

        // ✅ 只在不透明场景渲染前清除深度缓冲区
        // 这样可以确保透明场景能够正确地与不透明场景混合
        if (!isTransparent) {
            renderer.clearDepth();
        }

        // ✅ 遍历场景中的所有对象，设置材质状态
        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];

                materials.forEach((material) => {
                    // ✅ 关键修复：第一次遇到材质时保存其原始状态
                    if (!material.userData._hasOriginalStateSaved) {
                        material.userData.originalTransparent = material.transparent;
                        material.userData.originalOpacity = material.opacity;
                        material.userData._hasOriginalStateSaved = true;
                    }

                    if (isTransparent) {
                        // 透明场景：设置材质透明度，禁用深度写入
                        material.transparent = true;
                        material.opacity = sceneOpacity;
                        material.depthWrite = false;
                        material.depthTest = true; // 启用深度测试
                    } else {
                        // 不透明场景：恢复默认状态
                        // 注意：这里使用材质的原始设置，如果没有原始设置，使用默认值
                        // ✅ 修复：使用 hasOwnPropery 检查，避免 undefined 被当作 false
                        if (material.userData.hasOwnProperty('originalTransparent')) {
                            material.transparent = material.userData.originalTransparent;
                        }
                        if (material.userData.hasOwnProperty('originalOpacity')) {
                            material.opacity = material.userData.originalOpacity;
                        }
                        material.depthWrite = true; // 不透明场景总是写入深度
                        material.depthTest = true; // 启用深度测试
                    }
                    material.needsUpdate = true;
                });
            }
        });

        // 🔍 调试：检查场景中的模型是否在相机视野内（在大坐标场景下）
        // 检查是否是大坐标场景
        const isLargeCoordScene = Math.abs(camera.position.x) > 10000 || Math.abs(camera.position.z) > 10000;

        // ⚠️ 关键修复：在大坐标场景下检测和修复矩阵溢出
        if (isLargeCoordScene) {
            // 检查相机位置是否安全
            if (!isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
                console.warn('[rendererManager] ⚠️ 相机位置溢出，重置为安全位置');
                camera.position.set(0, 0, 100);
            }

            // 检查投影矩阵是否溢出
            const projMatrix = camera.projectionMatrix;
            if (projMatrix && projMatrix.elements) {
                let hasOverflow = false;
                for (let i = 0; i < projMatrix.elements.length; i++) {
                    if (!isFinite(projMatrix.elements[i]) || Math.abs(projMatrix.elements[i]) > 1e10) {
                        hasOverflow = true;
                        break;
                    }
                }

                if (hasOverflow) {
                    console.warn('[rendererManager] ⚠️ 投影矩阵溢出，重新计算');
                    camera.near = 0.1;
                    camera.far = 10000;
                    camera.updateProjectionMatrix();
                }
            }
        }

        // 🔍 大坐标场景模型可见性检查：仅在开发模式下每6000帧检查一次
        if (isDevelopmentMode() && isLargeCoordScene && (sortedIndex === 0) && animate.frameCount % 6000 === 0) {
            animate._lastDebugFrame = animate.frameCount;
            console.log(`[rendererManager] 🔍 大坐标场景模型可见性检查 (帧${animate.frameCount}, 场景${sortedIndex}):`);

            scene.traverse((object) => {
                if (object.isMesh && object.visible) {
                    // 获取模型的世界坐标边界框
                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());

                    // 计算模型到相机的距离
                    const distance = camera.position.distanceTo(center);

                    // 将中心点投影到 NDC 空间
                    const ndc = center.clone().project(camera);

                    const inNearFar = distance >= camera.near && distance <= camera.far;
                    const inFrustum = ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1 && ndc.z >= -1 && ndc.z <= 1;

                    console.log(`[rendererManager]  - ${object.name || object.parent?.userData?.fileName || 'unnamed'}:`, {
                        中心位置: `(${center.x.toFixed(0)}, ${center.y.toFixed(0)}, ${center.z.toFixed(0)})`,
                        距离: distance.toFixed(2) + 'm',
                        near: camera.near.toFixed(2),
                        far: camera.far.toFixed(2),
                        在范围内: inNearFar ? '✅' : '❌',
                        NDC: `(${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)}, ${ndc.z.toFixed(3)})`,
                        在视锥体内: inFrustum ? '✅' : '❌',
                        材质: object.material?.type,
                        可见: object.visible
                    });

                    // 如果模型不在视野内，输出警告
                    if (!inNearFar || !inFrustum) {
                        console.warn(`[rendererManager] ⚠️ 模型不可见:`, {
                            原因: !inNearFar ? '距离超出 near/far 范围' : 'NDC 超出视锥体',
                            距离: distance.toFixed(2),
                            near: camera.near.toFixed(2),
                            far: camera.far.toFixed(2),
                            NDC: `(${ndc.x.toFixed(3)}, ${ndc.y.toFixed(3)}, ${ndc.z.toFixed(3)})`
                        });
                    }
                }
            });
        }

        // ⚠️ 注意：深度测试设置已在 renderer.render() 方法中处理
        // 我们重写了 render() 方法，在每次渲染前设置正确的 depthFunc
        renderer.render(scene, camera);

        // 调试：输出渲染信息（前10帧）
        if (animate.frameCount <= 10) {
            const objectCount = scene.children.length;
            const meshCount = scene.children.filter(c => c.type === 'Mesh' || c.type === 'Group').length;
            console.log(`[rendererManager] 帧 ${animate.frameCount}: 渲染场景 ${sortedIndex}`, {
                opacity: sceneOpacity,
                isTransparent,
                objectCount,
                meshCount,
                cameraPos: camera.position.toArray().map(n => n.toFixed(2)),
                viewport: { vpLeft, vpBottom, vpWidth, vpHeight }
            });
        }

        // ⚠️ 注意：渲染后的修复已禁用
        // 因为我们已经重写了 renderer.render() 方法，在渲染前设置了正确的 depthFunc
        // 所以不需要在渲染后再次修复
        // 如果深度测试仍然有问题，可以在控制台中手动检查 WebGL 状态
    });

    renderer.setScissorTest(false);
}

// rendererManager 对象定义（使用 const 而非 export const，避免重复导出）
const rendererManager = {
    init(_canvas) {
        if (renderer) {
            return; // 防止重复初始化
        }
        canvas = _canvas;

        // 确保 canvas 样式正确，覆盖全屏并可穿透点击
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '1';
        canvas.style.pointerEvents = 'none';

        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            // ⚠️ 关键修复：禁用对数深度缓冲区
            // 对数深度缓冲区与自定义near/far值冲突，导致大坐标场景下投影矩阵计算错误
            // 禁用后使用标准深度缓冲区，通过优化near/far值来支持大坐标场景
            logarithmicDepthBuffer: true,
            // ✅ 保留绘图缓冲区以支持混合显示
            // 这样可以在多个场景渲染之间保留颜色缓冲区的内容
            preserveDrawingBuffer: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // 透明背景

        // ⚠️ 关键修复：重写 renderer.render() 方法，在渲染前设置正确的 depthFunc
        // Three.js 的 WebGLRenderer 会在渲染时重置 depthFunc 为 LEQUAL
        // 我们需要在每次渲染前强制设置正确的 depthFunc
        const originalRender = renderer.render.bind(renderer);
        renderer.render = function(scene, camera) {
            const gl = this.getContext();
            if (gl) {
                // 检查场景中是否有大坐标模型
                const LARGE_COORD_THRESHOLD = 10000;
                let hasLargeCoordModels = false;

                if (scene) {
                    scene.traverse((object) => {
                        if (object.isMesh || object.isGroup) {
                            const pos = object.position;
                            if (Math.abs(pos.x) > LARGE_COORD_THRESHOLD ||
                                Math.abs(pos.z) > LARGE_COORD_THRESHOLD) {
                                hasLargeCoordModels = true;
                            }
                        }
                    });
                }

                // 🔧 关键修复：强制使用 GREATER (515) 与 Cesium 兼容
                // Cesium 使用 GREATER，Three.js 默认使用 LEQUAL
                // 统一使用 GREATER 可以解决不同渲染引擎的深度测试冲突问题
                const GREATER = 515;
                gl.depthFunc(GREATER);
            }

            // 调用原始的 render 方法
            return originalRender(scene, camera);
        };

        // ⚠️ 关键修复：设置正确的深度函数，避免透视反转
        // WebGL 默认可能使用 GREATER (515)，导致"远大近小"问题
        // ⚠️ 但是，对于大坐标模型，必须使用 GREATER
        const gl = renderer.getContext();
        if (gl) {
            // 🔧 关键修复：启用深度测试和深度写入
            gl.enable(gl.DEPTH_TEST);
            gl.depthMask(true);

            // 🔧 关键修复：确保深度范围正确
            gl.depthRange(0, 1);

            // ✅ 修复：使用明确的数值常量，避免打包时变量替换错误
            const LEQUAL = 514;      // WebGLRenderingContext.LEQUAL
            const GREATER = 515;     // WebGLRenderingContext.GREATER

            const originalDepthFunc = gl.depthFunc.bind(gl);
            const depthFuncNames = {
                512: 'NEVER', 513: 'LESS', 514: 'LEQUAL',
                515: 'GREATER', 516: 'GEQUAL', 517: 'EQUAL',
                518: 'NOTEQUAL', 519: 'ALWAYS'
            };
            let interceptCount = 0;

            // ⚠️ 关键修复：禁用 depthFunc 拦截器
            // 因为我们已经重写了 renderer.render() 方法，在渲染前设置正确的 depthFunc
            // 所以不需要拦截器了，拦截器可能会干扰我们的逻辑
            // 保留原始的 depthFunc 方法
            // gl.depthFunc = originalDepthFunc;

            // 🔧 关键修复：强制使用 GREATER 与 Cesium 兼容
            // Cesium 使用 GREATER，统一深度函数可以解决渲染不一致问题
            gl.depthFunc(GREATER);
            console.log('[rendererManager] ✅ 深度函数已强制设置为 GREATER（与 Cesium 兼容）');

            // ⚠️ 关键修复：防止 disable() 禁用深度测试
            const originalDisable = gl.disable.bind(gl);
            gl.disable = function(cap) {
                if (cap === gl.DEPTH_TEST) {
                    console.warn('[rendererManager] ⚠️ 拦截到禁用深度测试的尝试，已阻止');
                    return; // 阻止禁用深度测试
                }
                return originalDisable.call(this, cap);
            };

            // 验证设置是否成功
            const currentDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
            const currentDepthTest = gl.getParameter(gl.DEPTH_TEST);
            const currentDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

            console.log(`[rendererManager] WebGL状态:`, {
                depthFunc: `${currentDepthFunc} (${depthFuncNames[currentDepthFunc]})`,
                depthTest: currentDepthTest,
                depthMask: currentDepthMask
            });

            // ⚠️ 关键修复：支持大坐标模式，允许使用 LEQUAL 或 GREATER
            const isValidDepthFunc = currentDepthFunc === 514 || currentDepthFunc === 515;  // LEQUAL 或 GREATER
            if (isValidDepthFunc && currentDepthTest && currentDepthMask) {
                console.log('[rendererManager] ✅ 深度设置正确（depthTest启用）');
            } else {
                console.warn('[rendererManager] ⚠️ 深度设置异常，将在渲染循环中持续修复');
            }

            // ⚠️ 持续修复机制：每帧都检查并修复
            // 因为 Cesium 或其他代码可能会覆盖设置
            // ⚠️ 关键修复：只检查 depthTest 和 depthMask，不强制 depthFunc
            const ensureCorrectDepthSettings = () => {
                const depthFunc = gl.getParameter(gl.DEPTH_FUNC);
                const depthTest = gl.getParameter(gl.DEPTH_TEST);
                const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK);

                // 允许的深度测试函数：LEQUAL (514) 和 GREATER (515)
                const isValidDepthFunc = depthFunc === 514 || depthFunc === 515;

                if (!isValidDepthFunc || !depthTest || !depthMask) {
                    // 强制修复
                    gl.enable(gl.DEPTH_TEST);
                    // 🔧 关键修复：如果 depthFunc 无效，强制使用 GREATER（与 Cesium 兼容）
                    if (!isValidDepthFunc) {
                        gl.depthFunc(515);  // GREATER
                    }
                    gl.depthMask(true);
                    return true; // 表示进行了修复
                }
                return false; // 表示无需修复
            };

            // 首次立即修复
            if (ensureCorrectDepthSettings()) {
                console.warn('[rendererManager] ⚠️ 初始化后检测到深度设置异常，已修复');
            }

            // 将修复函数暴露到全局，方便调试
            if (typeof window !== 'undefined') {
                window.__ensureWebGLDepthSettings = ensureCorrectDepthSettings;
            }
        }

        // ✅ 验证对数深度缓冲区是否启用（修复：直接检查 WebGL 上下文）
        const hasLogDepth = gl && gl.getParameter && gl.getParameter(gl.UNMASKED_RENDERER_WEBGL) ?
            // 通过检查是否支持 EXT_frag_depth 扩展来间接判断
            !!gl.getExtension('EXT_frag_depth') : false;

        console.log('[rendererManager] WebGLRenderer 已创建:', {
            logarithmicDepthBuffer: '❌ 已禁用（设置项: false）',
            hasEXT_frag_depth: hasLogDepth,
            rendererInfo: renderer ? '✅ 已创建' : '❌ 未创建'
        });

        // ⚠️ 注意：已禁用对数深度缓冲区以避免与大坐标near/far值冲突
        // 通过优化near/far值来支持大坐标场景
        console.log('[rendererManager] ⚠️ 对数深度缓冲区已禁用（创建参数: logarithmicDepthBuffer: false）');

        // 添加WebGL上下文监控
        
        // 监控WebGL上下文丢失
        canvas.addEventListener('webglcontextlost', (event) => {
            console.error('WebGL context lost:', event);
            event.preventDefault();
        });
        
        // 监控WebGL上下文恢复
        canvas.addEventListener('webglcontextrestored', (event) => {
            console.log('WebGL context restored:', event);
        });
        
        // 定期检查WebGL资源使用情况
        if (gl && gl.getParameter) {
            const checkResourceUsage = () => {
                try {
                    // 获取内存使用情况（如果可用）
                    const memoryInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (memoryInfo) {
                        const vendor = gl.getParameter(memoryInfo.UNMASKED_VENDOR_WEBGL);
                        const renderer = gl.getParameter(memoryInfo.UNMASKED_RENDERER_WEBGL);
                        console.log('WebGL Renderer Info:', { vendor, renderer });
                    }
                    
                    // 检查当前绑定的纹理数量
                    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
                    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
                    console.log('Texture Units:', { max: maxTextureUnits, activeTexture });
                    
                    // 检查当前绑定的缓冲区
                    const arrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
                    const elementArrayBuffer = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
                    console.log('Buffer Bindings:', { arrayBuffer, elementArrayBuffer });
                } catch (error) {
                    console.warn('Error checking WebGL resource usage:', error);
                }
            };
            
            // 每2分钟检查一次资源使用情况
            resourceCheckInterval = setInterval(checkResourceUsage, 120000);
            
            // 立即执行一次检查
            setTimeout(checkResourceUsage, 1000);
        }

        // 停止任何可能存在的旧动画循环，并开始新的循环
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        animate();

        // 处理待添加的场景（在 addScene 被提前调用时保存的场景）
        if (this.pendingScenes && this.pendingScenes.length > 0) {
            console.log(`Adding ${this.pendingScenes.length} pending scenes...`);
            this.pendingScenes.forEach(sceneInfo => {
                if (!scenes.find(s => s.scene === sceneInfo.scene)) {
                    scenes.push(sceneInfo);
                }
            });
            this.pendingScenes = [];
        }
    },

    addScene(sceneInfo) {
        console.log('[rendererManager] addScene called, renderer:', !!renderer, 'canvas:', !!canvas);
        // 检查 rendererManager 是否已初始化
        if (!renderer || !canvas) {
            console.warn('rendererManager not initialized yet. Scene will be added after init.');
            // 将场景保存到临时数组，等待初始化后添加
            if (!this.pendingScenes) {
                this.pendingScenes = [];
            }
            this.pendingScenes.push(sceneInfo);
            return;
        }
        // 默认透明度为 1.0（不透明）
        if (sceneInfo.opacity === undefined) {
            sceneInfo.opacity = 1.0;
        }

        // ✅ 保存场景中所有材质的原始状态
        if (sceneInfo.scene) {
            sceneInfo.scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach((material) => {
                        // 只保存一次（避免覆盖）
                        if (!material.userData._hasOriginalStateSaved) {
                            material.userData.originalTransparent = material.transparent;
                            material.userData.originalOpacity = material.opacity;
                            material.userData._hasOriginalStateSaved = true;
                        }
                    });
                }
            });
        }

        if (!scenes.find(s => s.scene === sceneInfo.scene)) {
            scenes.push(sceneInfo);
            console.log('[rendererManager] Scene added, total scenes:', scenes.length);
        }
    },

    // ✅ 设置场景透明度（0.0 - 1.0）
    setSceneOpacity(scene, opacity) {
        const sceneInfo = scenes.find(s => s.scene === scene);
        if (sceneInfo) {
            sceneInfo.opacity = Math.max(0, Math.min(1, opacity));
            console.log(`[rendererManager] Scene opacity set to: ${sceneInfo.opacity}`);
        } else {
            console.warn('[rendererManager] Scene not found:', scene);
        }
    },

    // ✅ 获取场景透明度
    getSceneOpacity(scene) {
        const sceneInfo = scenes.find(s => s.scene === scene);
        return sceneInfo ? sceneInfo.opacity : 1.0;
    },

    removeScene(sceneToRemove) {
        scenes = scenes.filter(info => info.scene !== sceneToRemove);
    },

    // ✅ 获取调试信息（暴露内部状态）
    getDebugInfo() {
        return {
            hasRenderer: !!renderer,
            hasCanvas: !!canvas,
            sceneCount: scenes.length,
            scenes: scenes.map((s, i) => ({
                index: i,
                hasScene: !!s.scene,
                hasCamera: !!s.camera,
                hasControls: !!s.controls,
                sceneChildren: s.scene ? s.scene.children.length : 0,
                cameraPosition: s.camera ? s.camera.position.toArray() : null,
                controlsTarget: s.controls ? s.controls.target.toArray() : null,
                visible: s.scene ? s.scene.children.filter(c => c.visible && c.type === 'Mesh').length : 0
            })),
            rendererInfo: renderer ? {
                logarithmicDepthBuffer: renderer.capabilities.isLogarithmicDepthBuffer,
                pixelRatio: renderer.getPixelRatio(),
                size: renderer.getSize(new THREE.Vector2()).toArray()
            } : null
        };
    },

    // ✅ 获取原始 scenes 数组（用于深度调试）
    getScenes() {
        return scenes;
    },

    // ✅ 获取原始 renderer（用于深度调试）
    getRenderer() {
        return renderer;
    },

    dispose() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (resourceCheckInterval) {
            clearInterval(resourceCheckInterval);
            resourceCheckInterval = null;
        }
        if (renderer) {
            renderer.dispose();
            renderer = null;
        }
        scenes = [];
        canvas = null;
    }
};

// ✅ 默认导出（IIFE 打包兼容）
export default rendererManager;

// ✅ 同时也导出命名导出（向后兼容）
export { rendererManager };