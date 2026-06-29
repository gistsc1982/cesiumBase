import { Fragment as e, Teleport as t, Transition as n, createBlock as r, createCommentVNode as i, createElementBlock as a, createElementVNode as o, createTextVNode as s, createVNode as c, normalizeClass as l, normalizeStyle as u, openBlock as d, renderList as f, renderSlot as p, resolveComponent as m, toDisplayString as h, vModelText as g, vShow as _, withCtx as v, withDirectives as y, withModifiers as b } from "vue";
//#region src/utils/CesiumEventManager.js
var x = class {
	constructor() {
		this.isReady = !1, this.listeners = /* @__PURE__ */ new Set(), this.cesiumInstance = null, this.viewerInstance = null, this.checkInterval = null, this.checkAttempts = 0, this.maxAttempts = 50;
	}
	init() {
		if (!(typeof window > "u")) {
			if (this.checkCesiumReady()) {
				this.setReady();
				return;
			}
			this.setupGlobalListener(), this.startPolling();
		}
	}
	checkCesiumReady() {
		if (typeof window > "u") return !1;
		let e = window.Cesium !== void 0, t = window.__cesiumViewer__ !== void 0;
		return e && t;
	}
	setupGlobalListener() {
		window.addEventListener("cesium-ready", this.handleCesiumReady), window.addEventListener("cesium-viewer-ready", this.handleViewerReady);
	}
	removeGlobalListener() {
		typeof window > "u" || (window.removeEventListener("cesium-ready", this.handleCesiumReady), window.removeEventListener("cesium-viewer-ready", this.handleViewerReady));
	}
	handleCesiumReady = () => {
		console.log("[CesiumEventManager] 📡 收到 cesium-ready 事件"), this.cesiumInstance = window.Cesium, window.__cesiumViewer__ && this.setReady();
	};
	handleViewerReady = () => {
		console.log("[CesiumEventManager] 📡 收到 cesium-viewer-ready 事件"), this.viewerInstance = window.__cesiumViewer__, window.Cesium && this.setReady();
	};
	startPolling() {
		this.checkInterval ||= (this.checkAttempts = 0, setInterval(() => {
			this.checkAttempts++, this.checkCesiumReady() ? (this.setReady(), this.stopPolling()) : this.checkAttempts >= this.maxAttempts && (console.warn("[CesiumEventManager] ⏰ Cesium 初始化检查超时"), this.stopPolling());
		}, 100));
	}
	stopPolling() {
		this.checkInterval &&= (clearInterval(this.checkInterval), null);
	}
	setReady() {
		this.isReady || (this.isReady = !0, this.cesiumInstance = window.Cesium, this.viewerInstance = window.__cesiumViewer__, console.log("[CesiumEventManager] ✅ Cesium 已就绪"), this.stopPolling(), this.notifyListeners(), this.dispatchGlobalEvent());
	}
	notifyListeners() {
		this.listeners.forEach((e) => {
			try {
				e(this.cesiumInstance, this.viewerInstance);
			} catch (e) {
				console.error("[CesiumEventManager] ❌ 监听器执行失败:", e);
			}
		});
	}
	dispatchGlobalEvent() {
		if (typeof window > "u") return;
		let e = new CustomEvent("cesium-all-ready", { detail: {
			cesium: this.cesiumInstance,
			viewer: this.viewerInstance
		} });
		window.dispatchEvent(e);
	}
	onReady(e) {
		if (typeof e != "function") return console.warn("[CesiumEventManager] ⚠️ 监听器必须是函数"), () => {};
		if (this.isReady) try {
			e(this.cesiumInstance, this.viewerInstance);
		} catch (e) {
			console.error("[CesiumEventManager] ❌ 监听器执行失败:", e);
		}
		else this.listeners.add(e);
		return () => {
			this.listeners.delete(e);
		};
	}
	async ready() {
		return new Promise((e) => {
			let t = this.onReady((n, r) => {
				t(), e({
					cesium: n,
					viewer: r
				});
			});
		});
	}
	getCesium() {
		return this.cesiumInstance;
	}
	getViewer() {
		return this.viewerInstance;
	}
	reset() {
		this.isReady = !1, this.cesiumInstance = null, this.viewerInstance = null, this.listeners.clear(), this.stopPolling();
	}
	destroy() {
		this.stopPolling(), this.removeGlobalListener(), this.listeners.clear(), this.isReady = !1, this.cesiumInstance = null, this.viewerInstance = null;
	}
}, S = typeof window < "u" && window.__cesiumEventManager__, C = S || new x();
!S && typeof window < "u" && (window.__cesiumEventManager__ = C, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => {
	C.init();
}) : C.init());
//#endregion
//#region \0plugin-vue:export-helper
var w = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, T = {
	name: "SfcBase",
	props: {
		onClose: {
			type: Function,
			default: null
		},
		panelInstanceId: {
			type: Number,
			default: null
		}
	},
	inject: { instanceId: { default: 1 } },
	data() {
		return {
			cesiumReady: !1,
			componentName: "SfcBase",
			boundEventHandlers: {},
			cesiumUnsubscribe: null
		};
	},
	computed: {
		isSingleton() {
			return this.panelInstanceId === null || this.panelInstanceId === void 0;
		},
		isMultiInstance() {
			return !this.isSingleton;
		},
		panelInstanceKey() {
			return this.isSingleton ? this.effectiveRegistrationKey || this.componentName : `${this.effectiveRegistrationKey || this.componentName}_${this.panelInstanceId}`;
		}
	},
	methods: {
		checkCesiumReady() {
			return typeof window < "u" && window.Cesium !== void 0 && window.__cesiumViewer__ ? (this.cesiumReady = !0, this.$logger?.info?.("[SfcBase] Cesium 已就绪"), !0) : !1;
		},
		waitForCesium(e, t = 5e3) {
			if (this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.checkCesiumReady()) {
				e && typeof e == "function" && e();
				return;
			}
			let n = null;
			t > 0 && (n = setTimeout(() => {
				this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.$logger?.warn?.(`[${this.componentName}] Cesium 初始化超时 (${t}ms)`);
			}, t)), this.cesiumUnsubscribe = C.onReady((t, r) => {
				n &&= (clearTimeout(n), null), this.cesiumReady = !0, this.$logger?.info?.(`[${this.componentName}] Cesium 已就绪（事件驱动）`), e && typeof e == "function" && e(t, r);
			});
		},
		getCesiumViewer() {
			return this.checkCesiumReady() ? window.__cesiumViewer__ : (this.$logger?.warn?.(`[${this.componentName}] Cesium 未就绪，无法获取 Viewer`), null);
		},
		getCesium() {
			return typeof window < "u" && window.Cesium !== void 0 ? window.Cesium : (this.$logger?.warn?.(`[${this.componentName}] Cesium 全局对象不存在`), null);
		},
		isValidCoordinate(e, t, n) {
			return typeof e == "number" && !isNaN(e) && e >= t && e <= n;
		},
		validateLonLat(e, t, n = null) {
			return this.isValidCoordinate(e, -180, 180) ? this.isValidCoordinate(t, -90, 90) ? n !== null && !this.isValidCoordinate(n, -1e3, 1e5) ? {
				valid: !1,
				message: "高度必须在合理范围内"
			} : {
				valid: !0,
				message: "坐标有效"
			} : {
				valid: !1,
				message: "纬度必须在 -90 到 90 之间"
			} : {
				valid: !1,
				message: "经度必须在 -180 到 180 之间"
			};
		},
		showMessage(e, t = "info", n = 3e3) {
			this.$logger?.info?.(`[${this.componentName}] ${t.toUpperCase()}: ${e}`), this.messageContent !== void 0 && (this.messageContent = e), this.messageType !== void 0 && (this.messageType = t), n > 0 && typeof this.clearMessage == "function" && setTimeout(() => this.clearMessage(), n);
		},
		clearMessage() {
			this.messageContent !== void 0 && (this.messageContent = "");
		},
		handleClose() {
			if (typeof window < "u") {
				let e = new CustomEvent(this.closeEventName, { detail: {
					componentName: this.componentName,
					instanceId: this.instanceId
				} });
				window.dispatchEvent(e), this.onClose && typeof this.onClose == "function" && this.onClose(), this.$logger?.info?.(`[${this.componentName}] 关闭事件已触发`);
			}
		},
		bindEventHandler(e, t) {
			if (typeof t != "function") return this.$logger?.warn?.(`[${this.componentName}] 事件处理器必须是函数`), null;
			let n = t.bind(this);
			return this.boundEventHandlers[e] = n, n;
		},
		getBoundHandler(e) {
			return this.boundEventHandlers[e] || null;
		},
		clearBoundHandlers() {
			this.boundEventHandlers = {};
		},
		flyToPosition(e, t, n, r = {}, i = 2) {
			return new Promise((a, o) => {
				let s = this.getCesiumViewer();
				if (!s) {
					o(/* @__PURE__ */ Error("Cesium Viewer 不可用"));
					return;
				}
				let c = this.getCesium();
				if (!c) {
					o(/* @__PURE__ */ Error("Cesium 全局对象不可用"));
					return;
				}
				try {
					let l = c.Cartesian3.fromDegrees(e, t, n), u = {
						heading: c.Math.toRadians(0),
						pitch: c.Math.toRadians(-45),
						roll: 0
					};
					s.camera.flyTo({
						destination: l,
						orientation: {
							...u,
							...r
						},
						duration: i,
						complete: () => a(),
						cancel: () => o(/* @__PURE__ */ Error("飞行操作被取消"))
					});
				} catch (e) {
					o(e);
				}
			});
		},
		viewGround(e, t, n = 0) {
			return this.flyToPosition(e, t, n, {
				heading: 0,
				pitch: -90,
				roll: 0
			}, 1.5);
		},
		createLogger() {
			let e = `[${this.componentName}]`;
			return {
				info: (t) => console.log(`${e} ${t}`),
				warn: (t) => console.warn(`${e} ⚠️ ${t}`),
				error: (t) => console.error(`${e} ❌ ${t}`),
				debug: (t) => console.debug(`${e} 🔍 ${t}`)
			};
		},
		initCesium(e) {
			this.$logger = this.createLogger(), this.$logger?.info?.("组件初始化"), this.checkCesiumReady() ? (this.cesiumReady = !0, e && e()) : (this.$logger?.info?.("等待 Cesium 初始化（事件驱动）..."), this.waitForCesium((t, n) => {
				this.$logger?.info?.("Cesium 已就绪"), e && e(t, n);
			}));
		},
		cleanup() {
			this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.clearBoundHandlers(), this.$logger?.info?.("资源已清理");
		}
	},
	mounted() {},
	beforeUnmount() {
		this.cleanup();
	}
}, ee = {
	class: "sfc-base",
	style: { display: "none" }
};
function E(t, n, r, s, c, l) {
	return d(), a(e, null, [i(" 基础组件无界面元素，仅作为逻辑基类 "), o("div", ee)], 2112);
}
var D = /*#__PURE__*/ w(T, [["render", E]]), te = class {
	constructor() {
		this.panelStates = /* @__PURE__ */ new Map(), this.cesiumObjects = /* @__PURE__ */ new Map(), this.panelVisibility = /* @__PURE__ */ new Map(), this.panelRegistry = /* @__PURE__ */ new Map(), this.eventListeners = /* @__PURE__ */ new Map(), this.mjsContainers = /* @__PURE__ */ new Map(), console.log("[PanelSingletonManager] 初始化完成");
	}
	savePanelState(e, t = {}) {
		let n = {};
		t.cesiumTilesets !== void 0 && (n.cesiumTilesets = new Map(t.cesiumTilesets)), t.cesiumTransforms !== void 0 && (n.cesiumTransforms = new Map(t.cesiumTransforms)), t.cesiumHeightOffsets !== void 0 && (n.cesiumHeightOffsets = new Map(t.cesiumHeightOffsets)), t.cesiumErrorHandlers !== void 0 && (n.cesiumErrorHandlers = new Map(t.cesiumErrorHandlers)), t.obliquePhotographyList !== void 0 && (n.obliquePhotographyList = t.obliquePhotographyList), t.configList !== void 0 && (n.configList = t.configList), t.cesiumObjects !== void 0 && (n.cesiumObjects = t.cesiumObjects), n.timestamp = t.timestamp === void 0 ? Date.now() : t.timestamp, this.panelStates.set(e, n), console.log(`[PanelSingletonManager] 💾 保存面板状态: ${e}`, {
			tilesets: n.cesiumTilesets?.size || 0,
			transforms: n.cesiumTransforms?.size || 0,
			items: n.obliquePhotographyList?.length || 0,
			configList: n.configList?.length || 0,
			cesiumObjects: n.cesiumObjects ? "存在" : "不存在",
			时间: new Date(n.timestamp).toLocaleTimeString()
		}), typeof window < "u" && (window.__panelSingletonManager__ || (window.__panelSingletonManager__ = this), window.panelSingletonManager || (window.panelSingletonManager = this));
	}
	getPanelState(e) {
		let t = this.panelStates.get(e);
		return t ? (console.log(`[PanelSingletonManager] 📦 获取面板状态: ${e}`, {
			tilesets: t.cesiumTilesets?.size || 0,
			transforms: t.cesiumTransforms?.size || 0,
			items: t.obliquePhotographyList?.length || 0,
			configList: t.configList?.length || 0,
			cesiumObjects: t.cesiumObjects ? "存在" : "不存在",
			时间: new Date(t.timestamp).toLocaleTimeString()
		}), t) : (console.log(`[PanelSingletonManager] ⚠️ 面板 ${e} 没有保存的状态`), null);
	}
	clearPanelState(e) {
		let t = this.panelStates.get(e);
		if (!t) {
			console.warn(`[PanelSingletonManager] ⚠️ 面板 ${e} 没有需要清除的状态`);
			return;
		}
		t.cesiumErrorHandlers && t.cesiumErrorHandlers.forEach((e, t) => {
			e && e.tileset && e.tileset.tileFailed && e.tileset.tileFailed.removeEventListener(e.errorHandler);
		}), this.panelStates.delete(e), console.log(`[PanelSingletonManager] 🗑️ 清除面板状态: ${e}`);
	}
	saveCesiumObject(e, t, n, r, i, a) {
		let o = this.cesiumObjects.get(e);
		o || (o = /* @__PURE__ */ new Map(), this.cesiumObjects.set(e, o)), o.set(t, {
			tileset: n,
			transform: r,
			heightOffset: i,
			errorHandler: a
		}), console.log(`[PanelSingletonManager] 📦 保存 Cesium 对象: ${e}/${t}`);
	}
	getCesiumObject(e, t) {
		let n = this.cesiumObjects.get(e);
		return n && n.get(t) || null;
	}
	setPanelVisible(e, t) {
		this.updatePanelVisible(e, t);
	}
	hasPanelState(e) {
		return this.panelStates.has(e);
	}
	getAllPanelNames() {
		return Array.from(this.panelStates.keys());
	}
	getStats() {
		return {
			面板数: this.panelStates.size,
			Cesium对象数: this.cesiumObjects.size,
			面板列表: this.getAllPanelNames()
		};
	}
	clearAll() {
		this.panelStates.forEach((e, t) => {
			e.cesiumErrorHandlers.forEach((e, t) => {
				e && e.tileset && e.tileset.tileFailed && e.tileset.tileFailed.removeEventListener(e.errorHandler);
			});
		}), this.panelStates.clear(), this.cesiumObjects.clear(), this.panelVisibility.clear(), console.log("[PanelSingletonManager] 🗑️ 清除所有面板状态");
	}
	registerPanel(e, t) {
		let n = this.panelRegistry.get(e), r = t.visible === !0, i = !r, a = !1;
		t.visible === !0 || t.visible === !1 ? (a = !0, console.log(`[PanelSingletonManager] 🎯 config.visible 是明确的布尔值: ${t.visible}，设置 _visibilityExplicitlySet = true`)) : n?._visibilityExplicitlySet && (a = !0, console.log("[PanelSingletonManager] 🔄 保留现有的 _visibilityExplicitlySet 标志")), this.panelRegistry.set(e, {
			component: t.component,
			props: t.props || {},
			visible: r,
			isClosed: i,
			_visibilityExplicitlySet: a
		}), console.log(`[PanelSingletonManager] ✅ 注册面板: ${e}`, {
			visible: r,
			isClosed: i,
			hasComponent: !!t.component,
			visibilityExplicitlySet: a
		});
	}
	unregisterPanel(e) {
		let t = this.panelRegistry.delete(e);
		return t ? console.log(`[PanelSingletonManager] 🗑️ 注销面板: ${e}`) : console.warn(`[PanelSingletonManager] ⚠️ 面板 ${e} 未注册`), t;
	}
	getPanel(e) {
		return this.panelRegistry.get(e) || null;
	}
	hasPanel(e) {
		return this.panelRegistry.has(e) || this.mjsContainers.has(e);
	}
	getAllPanels() {
		return Array.from(this.panelRegistry.entries()).map(([e, t]) => ({
			name: e,
			...t
		}));
	}
	updatePanelVisible(e, t) {
		if (this.isMjsContainer(e)) {
			this.updateMjsContainerVisible(e, t), this.emitEvent(e, {
				type: "visibleChange",
				panelName: e,
				visible: t,
				isClosed: !t
			});
			return;
		}
		let n = this.panelRegistry.get(e);
		n ? (n.visible = t, n._visibilityExplicitlySet = !0, t ? n.isClosed = !1 : n.isClosed = !0, console.log(`[PanelSingletonManager] 🔄 更新面板可见性: ${e} = ${t}, isClosed = ${n.isClosed}`), this.emitEvent(e, {
			type: "visibleChange",
			panelName: e,
			visible: t,
			isClosed: n.isClosed
		})) : console.warn(`[PanelSingletonManager] ⚠️ 面板 ${e} 未注册，无法更新可见性`);
	}
	getPanelVisible(e) {
		let t = this.panelRegistry.get(e);
		return t ? t.visible : null;
	}
	setPanelClosed(e, t) {
		let n = this.panelRegistry.get(e);
		n && (n.isClosed = t, t && (n.visible = !1), console.log(`[PanelSingletonManager] 🔒 设置面板关闭状态: ${e} = ${t}`));
	}
	getPanelClosed(e) {
		let t = this.panelRegistry.get(e);
		return t ? t.isClosed : null;
	}
	getRegistryStats() {
		return {
			已注册面板数: this.panelRegistry.size,
			可见面板数: Array.from(this.panelRegistry.values()).filter((e) => e.visible).length,
			关闭面板数: Array.from(this.panelRegistry.values()).filter((e) => e.isClosed).count
		};
	}
	clearRegistry() {
		this.panelRegistry.clear(), console.log("[PanelSingletonManager] 🗑️ 清空面板注册表");
	}
	getMjsContainerId(e) {
		return e === "DualCanvasViewer" ? "dualCanvasContainer" : `${e}Container`;
	}
	getIifeGlobalVarName(e) {
		return e === "DualCanvasViewer" ? "DualCanvasViewerPlugin" : e;
	}
	registerMjsContainer(e, t = {}) {
		let n = t.containerId || this.getMjsContainerId(e), r = t.iifeGlobalVar || this.getIifeGlobalVarName(e);
		this.mjsContainers.set(e, {
			containerId: n,
			iifeGlobalVar: r,
			visible: t.visible !== !1,
			isClosed: t.visible === !1
		}), console.log(`[PanelSingletonManager] ✅ 注册 mjs 容器: ${e}`, {
			containerId: n,
			iifeGlobalVar: r
		});
		let i = t.visible !== !1;
		this.updateMjsContainerVisible(e, i);
	}
	unregisterMjsContainer(e) {
		let t = this.mjsContainers.delete(e);
		return t ? console.log(`[PanelSingletonManager] 🗑️ 注销 mjs 容器: ${e}`) : console.warn(`[PanelSingletonManager] ⚠️ mjs 容器未注册: ${e}`), t;
	}
	updateMjsContainerVisible(e, t) {
		let n = this.mjsContainers.get(e);
		if (!n) {
			console.warn(`[PanelSingletonManager] ⚠️ mjs 容器未注册: ${e}`);
			return;
		}
		console.log(`[PanelSingletonManager] 🔍 查找容器: ${e}`, {
			containerId: n.containerId,
			iifeGlobalVar: n.iifeGlobalVar,
			当前可见性: n.visible
		});
		let r = document.getElementById(n.containerId);
		if (!r) {
			console.error(`[PanelSingletonManager] ❌ 容器未找到: ${n.containerId}`), console.log("[PanelSingletonManager] 🔍 当前页面所有包含 'dual' 的容器:", Array.from(document.querySelectorAll("[id*=\"dual\"], [class*=\"dual\"]")).map((e) => ({
				id: e.id,
				class: e.className,
				display: window.getComputedStyle(e).display
			})));
			return;
		}
		if (!r) {
			console.warn(`[PanelSingletonManager] ⚠️ mjs 容器 DOM 不存在: ${n.containerId}`);
			return;
		}
		let i = r.classList.contains("hidden");
		t ? r.classList.remove("hidden") : r.classList.add("hidden"), n.visible = t, n.isClosed = !t, console.log(`[PanelSingletonManager] 🔄 更新 mjs 容器可见性: ${e}, visible: ${t}, hidden: ${i} -> ${r.classList.contains("hidden")}, container:`, r), t && r.classList.contains("hidden") && console.error(`[PanelSingletonManager] ❌ 尝试显示容器但仍有 hidden 类: ${e}`);
	}
	getMjsContainer(e) {
		return this.mjsContainers.get(e) || null;
	}
	isMjsContainer(e) {
		return this.mjsContainers.has(e);
	}
	getAllMjsContainers() {
		return Array.from(this.mjsContainers.entries()).map(([e, t]) => ({
			name: e,
			...t
		}));
	}
	addEventListener(e, t) {
		this.eventListeners.has(e) || this.eventListeners.set(e, /* @__PURE__ */ new Set()), this.eventListeners.get(e).add(t), console.log(`[PanelSingletonManager] 📝 添加事件监听器: ${e}`);
	}
	removeEventListener(e, t) {
		this.eventListeners.has(e) && (this.eventListeners.get(e).delete(t), console.log(`[PanelSingletonManager] 🗑️ 移除事件监听器: ${e}`));
	}
	emitEvent(e, t) {
		this.eventListeners.has(e) && this.eventListeners.get(e).forEach((n) => {
			try {
				n(t);
			} catch (t) {
				console.error(`[PanelSingletonManager] ❌ 事件监听器执行错误: ${e}`, t);
			}
		});
	}
}, O = typeof window < "u" && (window.__panelSingletonManager__ || window.panelSingletonManager), k = O || new te();
!O && typeof window < "u" && (window.__panelSingletonManager__ = k, window.panelSingletonManager = k);
//#endregion
//#region src/components/FunctionPanelUIBase.vue
var A = typeof window < "u" && window.__panelSingletonManager__ || k, ne = {
	name: "FunctionPanelUIBase",
	mixins: [D],
	emits: [
		"close",
		"minimize",
		"expand",
		"lazy-load",
		"register-panel",
		"unregister-panel",
		"section-toggle"
	],
	inject: {
		registerPanelComponent: {
			type: Function,
			default: null
		},
		unregisterPanelComponent: {
			type: Function,
			default: null
		},
		getRegisteredPanels: {
			type: Function,
			default: null
		},
		setPanelVisible: {
			type: Function,
			default: null
		},
		getInstanceId: {
			type: Function,
			default: () => 1
		},
		multiInstanceManager: {
			type: Object,
			default: null
		},
		registerPanelInstance: {
			type: Function,
			default: null
		},
		unregisterPanelInstance: {
			type: Function,
			default: null
		},
		setPanelInstanceVisible: {
			type: Function,
			default: null
		}
	},
	props: {
		autoRegister: {
			type: Boolean,
			default: !1
		},
		registrationKey: {
			type: String,
			default: null
		},
		panelInstanceId: {
			type: Number,
			default: null
		},
		title: {
			type: String,
			default: "面板"
		},
		titleIcon: {
			type: String,
			default: "⚙️"
		},
		closeTooltip: {
			type: String,
			default: "关闭 (ESC)"
		},
		width: {
			type: Number,
			default: 360
		},
		height: {
			type: [Number, String],
			default: "auto"
		},
		maxHeight: {
			type: [Number, String],
			default: "70vh"
		},
		initialX: {
			type: [Number, String],
			default: "center"
		},
		initialY: {
			type: Number,
			default: 80
		},
		bodyPadding: {
			type: String,
			default: "20px"
		},
		allowMinimize: {
			type: Boolean,
			default: !0
		},
		closeEventName: {
			type: String,
			default: "functionPanelClose"
		},
		enableBlur: {
			type: Boolean,
			default: !1
		},
		blurAmount: {
			type: String,
			default: "8px"
		},
		enableBackdropFilter: {
			type: Boolean,
			default: !1
		},
		lazyLoad: {
			type: Boolean,
			default: !1
		},
		headerTools: {
			type: Array,
			default: () => []
		},
		sectionToggles: {
			type: Array,
			default: () => []
		}
	},
	data() {
		return {
			componentName: "FunctionPanelUIBase",
			_registryRegistered: !1,
			x: 0,
			y: 0,
			isDragging: !1,
			dragOffsetX: 0,
			dragOffsetY: 0,
			isMinimized: !1,
			isClosed: !0,
			_contentLoaded: !1,
			boundMouseMove: null,
			boundMouseUp: null,
			cachedPanelWidth: null,
			cachedPanelHeight: null,
			sectionVisibleState: {}
		};
	},
	computed: {
		effectiveRegistrationKey() {
			return this.registrationKey || this.componentName;
		},
		isSingletonByConfig() {
			if (typeof window < "u" && window.__functionPanelsConfig__) {
				let e = window.__functionPanelsConfig__.panels.find((e) => e.name === this.effectiveRegistrationKey);
				return e ? e.singleton !== !1 : !0;
			}
			return this.panelInstanceId === null || this.panelInstanceId === void 0;
		},
		panelStyles() {
			let e = {
				width: typeof this.width == "number" ? `${this.width}px` : this.width,
				height: typeof this.height == "number" ? `${this.height}px` : this.height,
				maxHeight: typeof this.maxHeight == "number" ? `${this.maxHeight}px` : this.maxHeight,
				transform: `translate(${this.x}px, ${this.y}px)`,
				transition: this.isDragging ? "none" : "transform 0.2s ease-out, opacity 0.3s ease"
			};
			return (this.panelInstanceId === 1 || this.panelInstanceId === 2) && console.log(`[FunctionPanelUIBase] 🎨 面板样式: ${this.effectiveRegistrationKey} #${this.panelInstanceId || "singleton"}`, {
				...e,
				isClosed: this.isClosed,
				x: this.x,
				y: this.y
			}), e;
		},
		bodyStyles() {
			return { padding: this.bodyPadding };
		},
		fabStyles() {
			return { transform: `translate(${this.x + this.width / 2 - 40}px, ${this.y}px)` };
		},
		sectionVisible() {
			return { ...this.sectionVisibleState };
		}
	},
	watch: { isClosed(e, t) {
		console.log(`[FunctionPanelUIBase] 🔄 isClosed 状态变化: ${this.effectiveRegistrationKey}`, {
			oldVal: t,
			newVal: e,
			panelRefExists: !!this.$refs.panelRef
		}), t === !0 && e === !1 && (console.log("[FunctionPanelUIBase] ✅ 面板从关闭变为打开，初始化位置"), this.$nextTick(() => {
			this.$nextTick(() => {
				this.initPosition();
			});
		}));
	} },
	mounted() {
		console.log("[FunctionPanelUIBase] 🔍 接收到的 props:", {
			panelName: this.componentName || this.effectiveRegistrationKey,
			所有Props: {
				autoRegister: this.autoRegister,
				registrationKey: this.registrationKey,
				panelInstanceId: this.panelInstanceId,
				componentName: this.componentName,
				title: this.title,
				initialX: this.initialX,
				initialY: this.initialY,
				registrationKey_value: this.registrationKey,
				effectiveRegistrationKey: this.effectiveRegistrationKey
			}
		}), this.autoRegister && this.effectiveRegistrationKey && !this._registryRegistered && this.registerToParent(), this._initSectionVisible();
		let e = this.panelInstanceId != null;
		if (console.log("[FunctionPanelUIBase] 🔍 多实例面板检查:", {
			panelName: this.effectiveRegistrationKey,
			panelInstanceId: this.panelInstanceId,
			isMultiInstance: e,
			typeofPanelInstanceId: typeof this.panelInstanceId
		}), e) {
			let e = this.isClosed;
			this.isClosed = !1, console.log(`[FunctionPanelUIBase] ✅ 多实例面板默认显示: ${this.effectiveRegistrationKey} #${this.panelInstanceId}, isClosed: ${e} -> ${this.isClosed}`);
		} else {
			let e = this.effectiveRegistrationKey;
			if (A.hasPanel(e)) {
				let t = A.getPanel(e);
				if (t) {
					let n = this.isClosed;
					this.isClosed = t.isClosed, console.log(`[FunctionPanelUIBase] 🔓 从 PanelSingletonManager 同步面板状态: ${e}, isClosed: ${n} -> ${this.isClosed}`), t.visible && this.isClosed && (console.log(`[FunctionPanelUIBase] ⚠️ 发现状态不一致: visible=${t.visible} 但 isClosed=${this.isClosed}，强制修正`), this.isClosed = !1, console.log("[FunctionPanelUIBase] ✅ 强制修正 isClosed: true -> false"));
				}
			} else {
				let t = this.isClosed, n = this.getInstanceConfig(), r = n ? n.visible !== !1 : !0;
				this.isClosed = !r, console.log(`[FunctionPanelUIBase] 🆕 面板首次创建，根据配置设置 isClosed: ${e}, ${t} -> ${this.isClosed} (visible=${r})`);
			}
		}
		e || (this._panelStateChangeListener = (e) => {
			let t = this.effectiveRegistrationKey;
			if (e.panelName === t && (console.log(`[FunctionPanelUIBase] 🔔 监听到 PanelSingletonManager 事件: ${t}`, e), e.type === "visibleChange")) {
				let n = this.isClosed;
				this.isClosed = e.isClosed, console.log(`[FunctionPanelUIBase] 🔄 更新 isClosed 状态: ${n} -> ${this.isClosed}`), console.log(`[FunctionPanelUIBase] 🔍 延迟加载检查: oldIsClosed=${n}, !this.isClosed=${!this.isClosed}, this.lazyLoad=${this.lazyLoad}, !this._contentLoaded=${!this._contentLoaded}`), n && !this.isClosed ? (this.$forceUpdate(), console.log(`[FunctionPanelUIBase] ✅ 强制重新渲染面板: ${t}`), this.lazyLoad && !this._contentLoaded ? (console.log(`[FunctionPanelUIBase] ⚡ 触发延迟加载: ${t}`), this._contentLoaded = !0, this.$nextTick(() => {
					console.log("[FunctionPanelUIBase] 📤 发送 lazy-load 事件"), this.$emit("lazy-load", { firstOpen: !0 });
				})) : console.log(`[FunctionPanelUIBase] ⏭️ 跳过延迟加载: lazyLoad=${this.lazyLoad}, _contentLoaded=${this._contentLoaded}`)) : console.log("[FunctionPanelUIBase] ⏭️ 不触发延迟加载: 状态不是从关闭变为打开");
			}
		}, A.addEventListener(this.effectiveRegistrationKey, this._panelStateChangeListener)), !this.isClosed && this.lazyLoad && !this._contentLoaded && (console.log(`[FunctionPanelUIBase] 🔍 面板初始状态为打开，触发延迟加载: ${this.effectiveRegistrationKey}`), this._contentLoaded = !0, this.$nextTick(() => {
			console.log("[FunctionPanelUIBase] 📤 发送 lazy-load 事件（初始状态）"), this.$emit("lazy-load", { firstOpen: !0 });
		})), this.initCesium(() => {
			this.$nextTick(() => {
				this.$nextTick(() => {
					this.initPosition();
				});
			});
		}), this.boundHandleKeydown = this.handleKeydown.bind(this), document.addEventListener("keydown", this.boundHandleKeydown);
	},
	beforeUnmount() {
		this.autoRegister && this.effectiveRegistrationKey && this.unregisterFromParent(), this.boundMouseMove && (document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundHandleMouseUp)), this.boundHandleKeydown && document.removeEventListener("keydown", this.boundHandleKeydown), this.panelInstanceId === null && this._panelStateChangeListener && A.removeEventListener(this.effectiveRegistrationKey, this._panelStateChangeListener), this.cleanup();
	},
	methods: {
		getInstanceConfig() {
			if (this.panelInstanceId !== null) {
				if (typeof window < "u" && window.__multiInstancePanelConfigManager__) return window.__multiInstancePanelConfigManager__.getPanelConfig(this.instanceId, this.registrationKey);
			} else if (typeof window < "u" && window.__functionPanelsConfigManager__) return window.__functionPanelsConfigManager__.getPanel(this.effectiveRegistrationKey);
			return null;
		},
		registerToParent() {
			if (!this.effectiveRegistrationKey) {
				console.warn("[FunctionPanelUIBase] 缺少 registrationKey 和 componentName，无法自动注册");
				return;
			}
			let e = this.panelInstanceId !== null;
			if (e && this.registerPanelInstance && typeof this.registerPanelInstance == "function") {
				if (typeof window < "u" && window.__multiInstancePanelConfigManager__) {
					let e = this.instanceId || 1;
					if (window.__multiInstancePanelConfigManager__.getPanelInstance(e, this.effectiveRegistrationKey, this.panelInstanceId)) {
						console.log(`[FunctionPanelUIBase #${e}] ${this.effectiveRegistrationKey} #${this.panelInstanceId} 实例已存在，跳过重复注册`), this._registryRegistered = !0;
						return;
					}
				}
				let e = this.getInstanceConfig(), t = {
					...this.$props,
					...e?.position || {}
				};
				this.registerPanelInstance(this.effectiveRegistrationKey, {
					component: this,
					props: t,
					visible: !0
				}, this.panelInstanceId), this._registryRegistered = !0, console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.effectiveRegistrationKey} 多实例注册完成`);
				return;
			}
			if (!e && this.registerPanelComponent && typeof this.registerPanelComponent == "function") {
				let e = this.getInstanceConfig(), t = {
					...this.$props,
					...e?.position || {}
				}, n = !1;
				if (A) {
					let t = A.getPanel(this.effectiveRegistrationKey);
					console.log(`[FunctionPanelUIBase] 🔍 检查面板 ${this.effectiveRegistrationKey}:`, {
						existingPanel: t ? {
							visible: t.visible,
							isClosed: t.isClosed,
							_visibilityExplicitlySet: t._visibilityExplicitlySet
						} : null,
						instanceConfig: e ? { visible: e.visible } : null
					}), t && t._visibilityExplicitlySet ? (n = t.visible, console.log(`[FunctionPanelUIBase] 🎯 使用管理器中的可见性状态: ${n} (用户已设置)`)) : t && t.visible === !0 ? (n = !0, console.log("[FunctionPanelUIBase] 🎯 保持现有的 visible: true")) : (n = e ? e.visible !== !1 : !1, console.log(`[FunctionPanelUIBase] 📋 使用实例配置可见性: ${n}`));
				} else n = e ? e.visible !== !1 : !1, console.log(`[FunctionPanelUIBase] ⚠️ 管理器不存在，使用实例配置: ${n}`);
				this.registerPanelComponent(this.effectiveRegistrationKey, {
					props: t,
					visible: n
				}), this._registryRegistered = !0, console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.effectiveRegistrationKey} 单例注册完成, visible: ${n}`);
				return;
			}
			let t = {
				key: this.effectiveRegistrationKey,
				props: this.$props
			};
			e && (t.component = this), this.$emit("register-panel", t), this._registryRegistered = !0, console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.registrationKey} 已通过事件${e ? "（多实例）" : ""}注册`);
		},
		unregisterFromParent() {
			if (this.effectiveRegistrationKey) {
				if (this.unregisterPanelComponent && typeof this.unregisterPanelComponent == "function") {
					this.unregisterPanelComponent(this.effectiveRegistrationKey), console.log(`[FunctionPanelUIBase] ${this.effectiveRegistrationKey} 已通过 inject 注销`);
					return;
				}
				this.$emit("unregister-panel", { key: this.effectiveRegistrationKey }), console.log(`[FunctionPanelUIBase] ${this.effectiveRegistrationKey} 已通过事件注销`);
			}
		},
		initPosition(e = 0) {
			let t = this.$refs.panelRef, n = !!t, r = this.isClosed;
			if (console.log(`[FunctionPanelUIBase] 🔧 初始化面板位置: ${this.effectiveRegistrationKey} #${this.panelInstanceId || "singleton"}`, {
				initialX: this.initialX,
				initialY: this.initialY,
				currentX: this.x,
				currentY: this.y,
				panelRef: n,
				panelRefElement: t ? t.tagName : "N/A",
				isClosed: r,
				windowInnerWidth: window.innerWidth,
				windowInnerHeight: window.innerHeight,
				panelWidth: this.width,
				retryCount: e
			}), r) {
				console.log("[FunctionPanelUIBase] ⏸️ 面板已关闭，跳过位置初始化，等待面板打开");
				return;
			}
			if (!n) {
				if (e >= 10) {
					console.error(`[FunctionPanelUIBase] ❌ panelRef 初始化超时，放弃初始化位置: ${this.effectiveRegistrationKey}`);
					return;
				}
				console.warn(`[FunctionPanelUIBase] ⚠️ panelRef 还不存在，延迟初始化位置（重试 ${e + 1}/10）`), setTimeout(() => {
					this.initPosition(e + 1);
				}, 100);
				return;
			}
			let i = this.initialX;
			if (i === "center") {
				let e = this.$refs.panelRef, t = e ? e.offsetWidth : this.width;
				i = Math.round((window.innerWidth - t) / 2), console.log("[FunctionPanelUIBase] 📍 居中计算:", {
					panelWidth: t,
					calculatedX: i
				});
			} else if (i === "right") {
				let e = this.$refs.panelRef, t = e ? e.offsetWidth : this.width, n = Math.max(20, t / 2);
				i = Math.round(window.innerWidth - t - n), console.log("[FunctionPanelUIBase] 📍 右侧对齐计算:", {
					panelWidth: t,
					windowInnerWidth: window.innerWidth,
					rightMargin: n,
					calculatedX: i
				});
			} else typeof i != "number" && (i = 20, console.log("[FunctionPanelUIBase] 📍 使用默认 x 值: 20"));
			let a = window.innerWidth - this.width - 20;
			i = Math.max(20, Math.min(i, a)), this.x = i, this.y = Math.max(20, Math.min(this.initialY, window.innerHeight - 100)), console.log(`[FunctionPanelUIBase] ✅ 面板位置已设置: ${this.effectiveRegistrationKey} #${this.panelInstanceId || "singleton"}`, {
				x: this.x,
				y: this.y,
				transform: `translate(${this.x}px, ${this.y}px)`
			});
		},
		onHeaderMouseDown(e) {
			e.button === 0 && (e.target.closest(".icon-btn") || (e.preventDefault(), this.startDrag(e)));
		},
		onPanelMouseDown(e) {},
		startDrag(e) {
			this.isDragging = !0;
			let t = this.$refs.panelRef.getBoundingClientRect();
			this.dragOffsetX = e.clientX - t.left, this.dragOffsetY = e.clientY - t.top, this.cachedPanelWidth = t.width, this.cachedPanelHeight = t.height, this.boundMouseMove = this.onMouseMove.bind(this), this.boundHandleMouseUp = this.onMouseUp.bind(this), document.addEventListener("mousemove", this.boundMouseMove), document.addEventListener("mouseup", this.boundHandleMouseUp), document.body.style.userSelect = "none", document.body.style.cursor = "grabbing";
		},
		onMouseMove(e) {
			if (!this.isDragging) return;
			let t = e.clientX - this.dragOffsetX, n = e.clientY - this.dragOffsetY, r = this.cachedPanelWidth || this.width;
			this.cachedPanelHeight;
			let i = -r + 40, a = window.innerWidth - 40;
			t = Math.max(i, Math.min(t, a));
			let o = window.innerHeight - 60;
			n = Math.max(0, Math.min(n, o)), this.x = Math.round(t), this.y = Math.round(n);
		},
		onMouseUp() {
			this.isDragging && (this.isDragging = !1, this.boundMouseMove && (document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundHandleMouseUp), this.boundMouseMove = null, this.boundHandleMouseUp = null), document.body.style.userSelect = "", document.body.style.cursor = "", this.snapToEdge());
		},
		snapToEdge() {
			let e = this.$refs.panelRef;
			if (!e) return;
			let t = e.getBoundingClientRect(), n = !1;
			Math.abs(t.left) < 30 && t.left >= -20 ? (this.x = 0, n = !0) : Math.abs(t.right - window.innerWidth) < 30 && (this.x = window.innerWidth - (this.cachedPanelWidth || t.width), n = !0), t.top < 30 && t.top >= -20 && (this.y = 0, n = !0), n && setTimeout(() => {
				this.$refs.panelRef?.classList.add("snapped"), setTimeout(() => {
					this.$refs.panelRef?.classList.remove("snapped");
				}, 300);
			}, 0), this.cachedPanelWidth = null, this.cachedPanelHeight = null;
		},
		toggleMinimize() {
			this.isMinimized = !this.isMinimized, this.$emit(this.isMinimized ? "minimize" : "expand");
		},
		toggleSection(e) {
			e in this.sectionVisibleState && (this.sectionVisibleState[e] = !this.sectionVisibleState[e], this.$emit("section-toggle", {
				key: e,
				visible: this.sectionVisibleState[e]
			}));
		},
		getSectionVisible(e) {
			return this.sectionVisibleState[e];
		},
		_initSectionVisible() {
			this.sectionToggles && this.sectionToggles.length > 0 && this.sectionToggles.forEach((e) => {
				e.key in this.sectionVisibleState || (this.sectionVisibleState[e.key] = e.defaultVisible !== !1);
			}), this.headerTools && this.headerTools.length > 0 && this.headerTools.forEach((e) => {
				e.key in this.sectionVisibleState || (this.sectionVisibleState[e.key] = e.defaultVisible !== !1);
			});
		},
		close() {
			let e = this.panelInstanceId || null, t = this.autoRegister && this.registrationKey && !e, n = !t && e !== null;
			if (t) {
				if (console.log(`[FunctionPanelUIBase] 🔄 面板假关闭（单例模式）: ${this.effectiveRegistrationKey}`), this.isClosed = !0, this.cleanup && typeof this.cleanup == "function" && this.cleanup(), A.updatePanelVisible(this.effectiveRegistrationKey, !1), console.log(`[FunctionPanelUIBase] ✅ 已通过 PanelSingletonManager 更新面板 ${this.effectiveRegistrationKey} 可见性为 false`), this.setPanelVisible && typeof this.setPanelVisible == "function") this.setPanelVisible(this.effectiveRegistrationKey, !1), console.log(`[FunctionPanelUIBase] ✅ 已设置面板 ${this.effectiveRegistrationKey} 可见性为 false`);
				else if (this.getRegisteredPanels && typeof this.getRegisteredPanels == "function") {
					let e = this.getRegisteredPanels();
					e && e[this.effectiveRegistrationKey] && (e[this.effectiveRegistrationKey].visible = !1, console.log(`[FunctionPanelUIBase] ✅ 已设置面板 ${this.effectiveRegistrationKey} 可见性为 false（直接修改）`));
				}
				if (typeof window < "u") {
					let e = new CustomEvent(`${this.closeEventName}FakeClose`, { detail: {
						componentName: this.componentName,
						registrationKey: this.effectiveRegistrationKey,
						preserveData: !0
					} });
					window.dispatchEvent(e);
				}
				setTimeout(() => {
					if (this.$emit("close", { preserveData: !0 }), typeof window < "u") {
						let e = new CustomEvent(this.closeEventName, { detail: { componentName: this.componentName } });
						window.dispatchEvent(e);
					}
					this.onClose && typeof this.onClose == "function" && this.onClose();
				}, 300);
			} else if (n) {
				console.log(`[FunctionPanelUIBase] 🗑️ 多实例面板注销: ${this.effectiveRegistrationKey} #${e}`), this.isClosed = !0, this.cleanup && typeof this.cleanup == "function" && this.cleanup();
				let t = `${this.effectiveRegistrationKey}_${e}`;
				if (console.log(`[FunctionPanelUIBase] 🎯 多实例面板关闭，panelKey: ${t}`), typeof window < "u" && window.__multiInstancePanelConfigManager__) {
					let t = this.instanceId || 1;
					window.__multiInstancePanelConfigManager__.unregisterPanelInstance(t, this.effectiveRegistrationKey, e), console.log(`[FunctionPanelUIBase] ✅ 面板已自己注销实例: ${this.effectiveRegistrationKey} #${e}`);
				}
				setTimeout(() => {
					if (this.$emit("close", {
						preserveData: !1,
						panelKey: t
					}), typeof window < "u") {
						let n = new CustomEvent(this.closeEventName, { detail: {
							componentName: this.componentName,
							panelInstanceId: e,
							panelKey: t
						} });
						window.dispatchEvent(n);
					}
					this.onClose && typeof this.onClose == "function" && this.onClose();
				}, 300);
			} else {
				console.log(`[FunctionPanelUIBase] ❌ 面板真关闭（多实例模式）: ${this.effectiveRegistrationKey}`), this.isClosed = !0, this.cleanup && typeof this.cleanup == "function" && this.cleanup();
				let e = this.panelInstanceId, t = e === null ? this.effectiveRegistrationKey : `${this.effectiveRegistrationKey}_${e}`;
				console.log(`[FunctionPanelUIBase] 🎯 多实例面板关闭，panelKey: ${t}, panelInstanceId: ${e}`), setTimeout(() => {
					if (this.$emit("close", {
						preserveData: !1,
						panelKey: t
					}), typeof window < "u") {
						let n = new CustomEvent(this.closeEventName, { detail: {
							componentName: this.componentName,
							panelInstanceId: e,
							panelKey: t
						} });
						window.dispatchEvent(n);
					}
					this.onClose && typeof this.onClose == "function" && this.onClose(), this.autoRegister && this.registrationKey && this.unregisterFromParent();
				}, 300);
			}
		},
		handleKeydown(e) {
			e.key === "Escape" && this.close();
		}
	}
}, re = { class: "header-left" }, ie = { class: "panel-title" }, j = { class: "header-controls" }, M = ["aria-label"], N = {
	width: "14",
	height: "14",
	viewBox: "0 0 14 14",
	fill: "none"
}, P = {
	key: 0,
	d: "M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, F = {
	key: 1,
	d: "M7 2V12M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, I = ["aria-label"], L = ["title"], R = { class: "fab-icon" }, z = { class: "fab-text" };
function B(e, s, f, m, g, x) {
	return d(), r(t, { to: "body" }, [
		c(n, { name: "panel-fade" }, {
			default: v(() => [g.isClosed ? i("v-if", !0) : (d(), a("div", {
				key: 0,
				class: l(["function-panel", {
					"is-dragging": g.isDragging,
					"is-minimized": g.isMinimized,
					"blur-enabled": f.enableBackdropFilter && f.enableBlur
				}]),
				style: u(x.panelStyles),
				ref: "panelRef",
				onMousedown: s[3] ||= (...e) => x.onPanelMouseDown && x.onPanelMouseDown(...e)
			}, [
				i(" 面板头部 "),
				o("div", {
					class: "panel-header",
					onMousedown: s[2] ||= (...e) => x.onHeaderMouseDown && x.onHeaderMouseDown(...e)
				}, [o("div", re, [s[5] ||= o("div", { class: "drag-indicator" }, [
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" })
				], -1), p(e.$slots, "header", {}, () => [o("h3", ie, h(f.title), 1)], !0)]), o("div", j, [f.allowMinimize ? (d(), a("button", {
					key: 0,
					onClick: s[0] ||= b((...e) => x.toggleMinimize && x.toggleMinimize(...e), ["stop"]),
					class: "icon-btn minimize-btn",
					type: "button",
					"aria-label": g.isMinimized ? "展开" : "最小化"
				}, [(d(), a("svg", N, [g.isMinimized ? (d(), a("path", F)) : (d(), a("path", P))]))], 8, M)) : i("v-if", !0), o("button", {
					onClick: s[1] ||= b((...e) => x.close && x.close(...e), ["stop"]),
					class: "icon-btn close-btn",
					type: "button",
					"aria-label": f.closeTooltip
				}, [...s[6] ||= [o("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none"
				}, [o("path", {
					d: "M2 2L12 12M12 2L2 12",
					stroke: "currentColor",
					"stroke-width": "2",
					"stroke-linecap": "round"
				})], -1)]], 8, I)])], 32),
				i(" 面板内容 "),
				c(n, {
					name: "content-slide",
					persisted: ""
				}, {
					default: v(() => [y(o("div", {
						class: "panel-body",
						style: u(x.bodyStyles)
					}, [p(e.$slots, "default", {
						isClosed: g.isClosed,
						panelInstanceId: f.panelInstanceId,
						isSingleton: x.isSingletonByConfig,
						sectionVisible: x.sectionVisible,
						toggleSection: x.toggleSection
					}, void 0, !0)], 4), [[_, !g.isMinimized]])]),
					_: 3
				})
			], 38))]),
			_: 3
		}),
		i(" 最小化时的浮动按钮 "),
		c(n, { name: "fab-fade" }, {
			default: v(() => [!g.isClosed && g.isMinimized ? (d(), a("button", {
				key: 0,
				class: "panel-fab",
				type: "button",
				style: u(x.fabStyles),
				onClick: s[4] ||= (...e) => x.toggleMinimize && x.toggleMinimize(...e),
				title: f.title
			}, [o("span", R, h(f.titleIcon || "⚙️"), 1), o("span", z, h(f.title), 1)], 12, L)) : i("v-if", !0)]),
			_: 1
		})
	]);
}
var V = /*#__PURE__*/ w(ne, [["render", B], ["__scopeId", "data-v-35108af7"]]), H = {
	name: "ObliqueHeightAdjustPanel",
	components: { FunctionPanelUIBase: V },
	mixins: [D],
	props: {
		registrationKey: {
			type: String,
			default: "ObliqueHeightAdjustPanel"
		},
		panelInstanceId: {
			type: Number,
			default: null
		},
		autoRegister: {
			type: Boolean,
			default: !1
		},
		initialX: {
			type: [Number, String],
			default: "right"
		},
		initialY: {
			type: Number,
			default: 200
		},
		selectedLayer: {
			type: Object,
			default: null
		}
	},
	data() {
		return {
			componentName: "ObliqueHeightAdjustPanel",
			presets: [
				{
					value: 0,
					label: "0m"
				},
				{
					value: 50,
					label: "50m"
				},
				{
					value: 100,
					label: "100m"
				},
				{
					value: 200,
					label: "200m"
				},
				{
					value: 500,
					label: "500m"
				},
				{
					value: 1e3,
					label: "1km"
				}
			]
		};
	},
	computed: { panelTitle() {
		return this.selectedLayer ? `${this.selectedLayer.name} 高度调整` : "高度调整";
	} },
	methods: {
		handleClose() {
			console.log(`[${this.componentName}] 面板关闭`), this.$emit("close");
		},
		handleMinimize() {
			console.log(`[${this.componentName}] 面板已最小化`);
		},
		handleExpand() {
			console.log(`[${this.componentName}] 面板已展开`);
		},
		onHeightSliderInput(e) {
			if (!this.selectedLayer) return;
			let t = parseFloat(e.target.value);
			this.$emit("height-preview", {
				layer: this.selectedLayer,
				value: t
			});
		},
		onHeightSliderChange(e) {
			if (!this.selectedLayer) return;
			let t = parseFloat(e.target.value);
			this.$emit("height-change", {
				layer: this.selectedLayer,
				value: t
			});
		},
		onHeightInputChange(e) {
			if (!this.selectedLayer) return;
			let t = parseFloat(e.target.value);
			isNaN(t) || this.$emit("height-change", {
				layer: this.selectedLayer,
				value: t
			});
		},
		applyRecommendedOffset() {
			if (this.selectedLayer) {
				if (this.selectedLayer.recommendedOffset === null || this.selectedLayer.recommendedOffset === void 0) {
					console.warn(`[${this.componentName}] 没有推荐偏移值`);
					return;
				}
				this.$emit("height-change", {
					layer: this.selectedLayer,
					value: this.selectedLayer.recommendedOffset
				});
			}
		},
		applyPreset(e) {
			this.selectedLayer && this.$emit("height-change", {
				layer: this.selectedLayer,
				value: e
			});
		},
		resetToZero() {
			this.selectedLayer && this.$emit("height-change", {
				layer: this.selectedLayer,
				value: 0
			});
		}
	}
}, U = {
	key: 0,
	class: "recommended-offset-banner"
}, W = { class: "banner-content" }, G = { class: "banner-text" }, K = { class: "banner-suggestion" }, q = { class: "highlight" }, J = ["disabled"], Y = { class: "current-height-card" }, ae = { class: "height-value" }, oe = { class: "value" }, se = { class: "adjustment-section" }, ce = { class: "slider-container" }, le = ["value"], ue = { class: "precise-input-section" }, de = { class: "input-group" }, fe = ["value"], pe = { class: "preset-section" }, me = { class: "preset-grid" }, he = ["onClick"];
function ge(t, n, c, u, p, g) {
	let _ = m("FunctionPanelUIBase");
	return d(), r(_, {
		title: g.panelTitle,
		"title-icon": "🌏",
		width: 360,
		"max-height": "70vh",
		"initial-x": c.initialX,
		"initial-y": c.initialY,
		"allow-minimize": !0,
		"close-event-name": "obliqueHeightAdjustPanelClose",
		"auto-register": c.autoRegister === void 0 ? !1 : c.autoRegister,
		"registration-key": c.registrationKey || "ObliqueHeightAdjustPanel",
		"panel-instance-id": c.panelInstanceId,
		onClose: g.handleClose,
		onMinimize: g.handleMinimize,
		onExpand: g.handleExpand
	}, {
		default: v(() => [c.selectedLayer ? (d(), a(e, { key: 0 }, [
			i(" 推荐偏移值提示 "),
			c.selectedLayer.loaded && c.selectedLayer.recommendedOffset !== void 0 && c.selectedLayer.recommendedOffset !== null ? (d(), a("div", U, [o("div", W, [
				n[8] ||= o("svg", {
					class: "banner-icon",
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					"stroke-width": "2"
				}, [o("path", {
					d: "M9 18h6M10 22h4M12 2v1M12 18v-2M12 14a4 4 0 100-8 4 4 0 000 8z",
					"stroke-linecap": "round",
					"stroke-linejoin": "round"
				})], -1),
				o("div", G, [n[7] ||= o("div", { class: "banner-main" }, "检测到倾斜摄影地形高度较低", -1), o("div", K, [
					n[5] ||= s(" 建议向上偏移 ", -1),
					o("span", q, h(c.selectedLayer.recommendedOffset.toFixed(1)) + " 米", 1),
					n[6] ||= s(" 以与大坐标模型底部对齐 ", -1)
				])]),
				o("button", {
					onClick: n[0] ||= (...e) => g.applyRecommendedOffset && g.applyRecommendedOffset(...e),
					class: "apply-recommended-btn",
					disabled: Math.abs(c.selectedLayer.heightOffset - c.selectedLayer.recommendedOffset) < .1
				}, h(Math.abs(c.selectedLayer.heightOffset - c.selectedLayer.recommendedOffset) < .1 ? "已应用" : "应用推荐值"), 9, J)
			])])) : i("v-if", !0),
			i(" 当前高度偏移显示 "),
			o("div", Y, [n[10] ||= o("div", { class: "card-header" }, [o("h4", { class: "card-title" }, "当前高度偏移"), o("span", {
				class: "hint-icon",
				title: "调整倾斜摄影的整体高度，正值向上，负值向下"
			}, [o("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2"
			}, [o("circle", {
				cx: "12",
				cy: "12",
				r: "10"
			}), o("path", {
				d: "M12 16v-4M12 8h.01",
				"stroke-linecap": "round"
			})])])], -1), o("div", ae, [o("span", oe, h((c.selectedLayer.heightOffset || 0).toFixed(2)), 1), n[9] ||= o("span", { class: "unit" }, "米", -1)])]),
			i(" 高度调整滑块 "),
			o("div", se, [
				n[12] ||= o("div", { class: "section-label" }, [o("span", null, "调整偏移"), o("span", { class: "range-hint" }, "-2000m ~ +2000m")], -1),
				o("div", ce, [o("input", {
					type: "range",
					min: "-2000",
					max: "2000",
					step: "1",
					value: c.selectedLayer.heightOffset || 0,
					onInput: n[1] ||= (...e) => g.onHeightSliderInput && g.onHeightSliderInput(...e),
					onChange: n[2] ||= (...e) => g.onHeightSliderChange && g.onHeightSliderChange(...e),
					class: "height-slider"
				}, null, 40, le), n[11] ||= o("div", { class: "slider-track-fill" }, null, -1)]),
				n[13] ||= o("div", { class: "usage-hint" }, "调整后使倾斜摄影与大坐标模型高度对齐", -1)
			]),
			i(" 精确输入 "),
			o("div", ue, [n[15] ||= o("label", { class: "input-label" }, "精确设置偏移（米）", -1), o("div", de, [o("input", {
				type: "number",
				value: c.selectedLayer.heightOffset || 0,
				onChange: n[3] ||= (...e) => g.onHeightInputChange && g.onHeightInputChange(...e),
				class: "number-input",
				step: "0.1"
			}, null, 40, fe), o("button", {
				onClick: n[4] ||= (...e) => g.resetToZero && g.resetToZero(...e),
				class: "reset-btn",
				title: "重置为0"
			}, [...n[14] ||= [o("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2"
			}, [o("path", {
				d: "M3 12a9 9 0 1018 0M3 12h18M12 3v9",
				"stroke-linecap": "round",
				"stroke-linejoin": "round"
			})], -1), s(" 重置 ", -1)]])])]),
			i(" 快捷预设 "),
			o("div", pe, [n[16] ||= o("div", { class: "section-label" }, "快捷预设", -1), o("div", me, [(d(!0), a(e, null, f(p.presets, (e) => (d(), a("button", {
				key: e.value,
				onClick: (t) => g.applyPreset(e.value),
				class: l(["preset-btn", { active: Math.abs(c.selectedLayer.heightOffset - e.value) < .1 }])
			}, h(e.label), 11, he))), 128))])])
		], 64)) : (d(), a(e, { key: 1 }, [i(" 无选中图层提示 "), n[17] ||= o("div", { class: "empty-state" }, [o("svg", {
			class: "empty-icon",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2"
		}, [o("path", {
			d: "M9 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2h-4M9 20v-6M9 20l6-6M9 20l6 6",
			"stroke-linecap": "round",
			"stroke-linejoin": "round"
		})]), o("div", { class: "empty-text" }, "请先在倾斜摄影面板中选择一个已加载的图层")], -1)], 2112))]),
		_: 1
	}, 8, [
		"title",
		"initial-x",
		"initial-y",
		"auto-register",
		"registration-key",
		"panel-instance-id",
		"onClose",
		"onMinimize",
		"onExpand"
	]);
}
var _e = /*#__PURE__*/ w(H, [["render", ge], ["__scopeId", "data-v-80456ab5"]]), X = new class {
	constructor() {
		this.configDefinitions = new Map([["oblique-photography", {
			id: "oblique-photography",
			name: "倾斜摄影配置",
			fileName: "oblique_photography.json",
			relativePath: "gis/oblique_photography.json",
			description: "倾斜摄影模型加载配置",
			icon: "📷",
			category: "gis"
		}]]), this.serverConfig = {
			baseURL: this.detectServerURL(),
			apiPort: 8081,
			dataAPI: "api/data",
			syncAPI: "api/sync",
			timeout: 3e4
		}, typeof window < "u" && window.__pendingConfigDefinitions__ && window.__pendingConfigDefinitions__.forEach((e, t) => {
			this.configDefinitions.has(t) || (this.configDefinitions.set(t, e), console.log(`[DataManager] ✅ 加载待注册配置: ${t}`));
		}), typeof window < "u" && (window.__dataManager__ = this), console.log("[DataManager] 初始化完成"), console.log("[DataManager] 服务器配置:", this.serverConfig);
	}
	detectServerURL() {
		if (typeof window > "u") return "http://192.168.31.146:8080";
		let e = window.location.href, t = new URL(e);
		return t.hostname === "localhost" || t.hostname === "127.0.0.1" ? "http://192.168.31.146:8080" : `${t.protocol}//${t.hostname}:${t.port || 80}`;
	}
	setServerConfig(e) {
		this.serverConfig = {
			...this.serverConfig,
			...e
		}, console.log("[DataManager] 更新服务器配置:", this.serverConfig);
	}
	getAPIURL(e) {
		let t = new URL(this.serverConfig.baseURL);
		return t.port = this.serverConfig.apiPort.toString(), `${t.toString().replace(/\/$/, "")}/${e}`;
	}
	getDataURL(e) {
		return `${this.serverConfig.baseURL.replace(/\/$/, "")}/data/${e}`;
	}
	getAvailableConfigs() {
		return Array.from(this.configDefinitions.values()).map((e) => ({
			id: e.id,
			name: e.name,
			fileName: e.fileName,
			description: e.description,
			icon: e.icon,
			category: e.category
		}));
	}
	getConfigDefinition(e) {
		return this.configDefinitions.get(e) || null;
	}
	async loadFromServer(e) {
		let t = this.getConfigDefinition(e);
		if (!t) return console.error(`[DataManager] ❌ 未找到配置: ${e}`), null;
		try {
			let e = this.getAPIURL(`${this.serverConfig.dataAPI}/${t.relativePath}`);
			console.log(`[DataManager] 📡 从 API 服务器加载: ${e}`);
			let n = new AbortController(), r = setTimeout(() => n.abort(), this.serverConfig.timeout), i = await fetch(e, {
				method: "GET",
				mode: "cors",
				cache: "no-cache",
				signal: n.signal
			});
			if (clearTimeout(r), !i.ok) throw Error(`HTTP ${i.status}: ${i.statusText}`);
			let a = await i.json();
			if (a.success && a.data) return console.log(`[DataManager] ✅ 从 API 服务器加载成功，数据项: ${Array.isArray(a.data) ? a.data.length : Object.keys(a.data).length}`), console.log(`[DataManager] 数据来源: ${a.source}`), a.data;
			throw Error(a.error || "加载数据失败");
		} catch (e) {
			e.name === "AbortError" ? console.error("[DataManager] ❌ 加载超时") : console.error("[DataManager] ❌ 从 API 服务器加载失败:", e), console.log("[DataManager] 🔄 回退到静态文件加载");
			try {
				let e = this.getDataURL(t.relativePath), n = await fetch(e, { cache: "no-cache" });
				if (n.ok) {
					let e = await n.json();
					return console.log("[DataManager] ✅ 从静态文件加载成功"), e;
				}
			} catch (e) {
				console.error("[DataManager] ❌ 静态文件加载也失败:", e);
			}
			return null;
		}
	}
	async uploadToServer(e, t, n = {}) {
		let r = this.getConfigDefinition(e);
		if (!r) return console.error(`[DataManager] ❌ 未找到配置: ${e}`), {
			success: !1,
			error: "配置不存在"
		};
		try {
			console.log(`[DataManager] 📤 上传配置到服务器: ${r.name}`);
			let n = this.validateConfig(e, t);
			if (!n.valid) return console.error("[DataManager] ❌ 数据验证失败:", n.errors), {
				success: !1,
				error: "数据验证失败",
				errors: n.errors
			};
			let i = this.getAPIURL(`${this.serverConfig.dataAPI}/${r.relativePath}`);
			console.log(`[DataManager] 📡 上传URL: ${i}`);
			let a = new AbortController(), o = setTimeout(() => a.abort(), this.serverConfig.timeout), s = await fetch(i, {
				method: "POST",
				mode: "cors",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: t }),
				signal: a.signal
			});
			if (clearTimeout(o), !s.ok) throw Error(`HTTP ${s.status}: ${s.statusText}`);
			let c = await s.json();
			if (c.success) return console.log(`[DataManager] ✅ 上传成功: ${r.fileName}`), {
				success: !0,
				message: c.message || "上传成功",
				result: c
			};
			throw Error(c.error || "上传失败");
		} catch (e) {
			return console.error("[DataManager] ❌ 上传失败:", e), {
				success: !1,
				error: e.message,
				hint: "请检查服务器配置和网络连接"
			};
		}
	}
	async exportConfig(e, t, n = {}) {
		let r = this.getConfigDefinition(e);
		if (!r) return console.error(`[DataManager] ❌ 未找到配置: ${e}`), !1;
		try {
			console.log(`[DataManager] 📤 导出配置（本地）: ${r.name}`);
			let e = n.pretty !== !1, i = n.fileName || r.fileName, a = JSON.stringify(t, null, e ? 2 : 0), o = new Blob([a], { type: "application/json" }), s = URL.createObjectURL(o), c = document.createElement("a");
			return c.href = s, c.download = i, document.body.appendChild(c), c.click(), document.body.removeChild(c), URL.revokeObjectURL(s), console.log(`[DataManager] ✅ 导出成功: ${i}`), !0;
		} catch (e) {
			return console.error("[DataManager] ❌ 导出失败:", e), !1;
		}
	}
	async importConfig(e = {}) {
		try {
			console.log("[DataManager] 📥 准备导入配置（本地）");
			let t = document.createElement("input");
			t.type = "file", t.accept = e.accept || ".json,application/json", t.style.display = "none";
			let n = new Promise((e, n) => {
				t.onchange = (t) => {
					let r = t.target.files[0];
					r ? e(r) : n(/* @__PURE__ */ Error("未选择文件"));
				}, t.oncancel = () => {
					n(/* @__PURE__ */ Error("用户取消"));
				};
			});
			document.body.appendChild(t), t.click(), document.body.removeChild(t);
			let r = await n;
			console.log(`[DataManager] 📄 读取文件: ${r.name}`);
			let i = await this.readFile(r, e.onProgress), a = JSON.parse(i);
			return console.log(`[DataManager] ✅ 导入成功，数据项: ${Array.isArray(a) ? a.length : Object.keys(a).length}`), {
				data: a,
				fileName: r.name,
				fileSize: r.size,
				lastModified: new Date(r.lastModified)
			};
		} catch (e) {
			return console.error("[DataManager] ❌ 导入失败:", e), null;
		}
	}
	readFile(e, t) {
		return new Promise((n, r) => {
			let i = new FileReader();
			i.onload = (e) => n(e.target.result), i.onerror = () => r(/* @__PURE__ */ Error("文件读取失败")), i.onprogress = (e) => {
				e.lengthComputable && t && t(e.loaded / e.total * 100);
			}, i.readAsText(e);
		});
	}
	validateConfig(e, t) {
		let n = this.getConfigDefinition(e), r = [];
		if (!n) return r.push(`未找到配置定义: ${e}`), {
			valid: !1,
			errors: r
		};
		if (t == null) return r.push("数据不能为空"), {
			valid: !1,
			errors: r
		};
		switch (e) {
			case "oblique-photography":
				Array.isArray(t) ? t.forEach((e, t) => {
					e.id || r.push(`第 ${t + 1} 项缺少 id 字段`), e.name || r.push(`第 ${t + 1} 项缺少 name 字段`), e.url || r.push(`第 ${t + 1} 项缺少 url 字段`);
				}) : r.push("倾斜摄影配置必须是数组");
				break;
		}
		return {
			valid: r.length === 0,
			errors: r
		};
	}
	getConfigStats(e, t) {
		let n = {
			configId: e,
			configName: this.getConfigDefinition(e)?.name || "未知",
			itemCount: 0,
			dataSize: JSON.stringify(t).length,
			dataSizeKB: 0,
			lastModified: (/* @__PURE__ */ new Date()).toISOString()
		};
		return Array.isArray(t) ? n.itemCount = t.length : typeof t == "object" && t && (n.itemCount = Object.keys(t).length), n.dataSizeKB = (n.dataSize / 1024).toFixed(2), n;
	}
	async testConnection() {
		try {
			let e = `${this.serverConfig.baseURL}/`;
			console.log(`[DataManager] 🔌 测试服务器连接: ${e}`);
			let t = await fetch(e, {
				method: "HEAD",
				mode: "cors",
				cache: "no-cache"
			});
			return console.log(`[DataManager] ✅ 服务器连接成功: ${t.status}`), t.ok || t.status === 404;
		} catch (e) {
			return console.error("[DataManager] ❌ 服务器连接失败:", e), !1;
		}
	}
	async listServerFiles(e = "") {
		try {
			console.log(`[DataManager] 📂 获取服务器文件列表: ${e}`);
			let t = this.getAPIURL("api/configs"), n = new AbortController(), r = setTimeout(() => n.abort(), this.serverConfig.timeout), i = await fetch(t, {
				method: "GET",
				mode: "cors",
				cache: "no-cache",
				signal: n.signal
			});
			if (clearTimeout(r), !i.ok) throw Error(`HTTP ${i.status}: ${i.statusText}`);
			let a = await i.json();
			if (a.success) return console.log(`[DataManager] ✅ 获取文件列表成功，共 ${a.data.length} 个文件`), a.data;
			throw Error(a.error || "获取文件列表失败");
		} catch (e) {
			return console.error("[DataManager] ❌ 获取文件列表失败:", e), [];
		}
	}
	async getServerDirectoryStructure() {
		try {
			let e = await this.listServerFiles(), t = /* @__PURE__ */ new Map();
			e.forEach((e) => {
				let n = e.filePath.includes("/") ? e.filePath.substring(0, e.filePath.lastIndexOf("/")) : "";
				t.has(n) || t.set(n, []), t.get(n).push({
					name: e.fileName,
					path: e.filePath,
					size: e.fileSize,
					modified: e.modifiedTime
				});
			});
			let n = {};
			return t.forEach((e, t) => {
				n[t || "/"] = e;
			}), n;
		} catch (e) {
			return console.error("[DataManager] ❌ 获取目录结构失败:", e), {};
		}
	}
}(), Z = typeof window < "u" && window.__panelSingletonManager__ || k, ve = "/data/gis/oblique_photography.json", Q = "oblique-photography", ye = {
	name: "ObliquePhotographyPanel",
	components: {
		FunctionPanelUIBase: V,
		ObliqueHeightAdjustPanel: _e
	},
	mixins: [D],
	props: {
		registrationKey: {
			type: String,
			default: "ObliquePhotographyPanel"
		},
		panelInstanceId: {
			type: Number,
			default: null
		},
		autoRegister: {
			type: Boolean,
			default: !0
		},
		initialX: {
			type: [Number, String],
			default: "center"
		},
		initialY: {
			type: Number,
			default: 120
		},
		lazyLoad: {
			type: Boolean,
			default: !1
		}
	},
	data() {
		return {
			componentName: "ObliquePhotographyPanel",
			obliquePhotographyList: [],
			cesiumViewer: null,
			Cesium: null,
			showAddDialog: !1,
			showEditDialog: !1,
			showDeleteDialog: !1,
			showImportDialog: !1,
			serverFiles: [],
			serverDirectories: {},
			selectedServerFile: null,
			loadingServerFiles: !1,
			currentServerDirectory: "",
			allFilesMap: /* @__PURE__ */ new Map(),
			serverBaseURL: "",
			apiServerURL: "",
			formData: {
				id: "",
				name: "",
				url: ""
			},
			editingItem: null,
			deleteTarget: null,
			showHeightPanel: !1,
			selectedLayer: null,
			selectedItemId: null
		};
	},
	beforeCreate() {
		this._cesiumTilesets = /* @__PURE__ */ new Map(), this._cesiumTransforms = /* @__PURE__ */ new Map(), this._cesiumHeightOffsets = /* @__PURE__ */ new Map(), this._cesiumErrorHandlers = /* @__PURE__ */ new Map();
	},
	created() {
		this.serverBaseURL = process.env.VUE_APP_SERVER_BASE_URL || "http://192.168.31.146:8080";
		let e = process.env.VUE_APP_API_PORT || "8081", t = new URL(this.serverBaseURL);
		t.port = e, this.apiServerURL = t.toString().replace(/\/$/, ""), console.log(`[${this.componentName}] 🔧 服务器配置:`, {
			frontend: this.serverBaseURL,
			api: this.apiServerURL
		});
	},
	computed: {
		computedHeightPanelX() {
			return typeof this.initialX == "number" ? this.initialX + 450 : this.initialX;
		},
		currentDirectoryFiles() {
			let e = this.currentServerDirectory || "";
			return this.serverFiles.filter((t) => {
				let n = t.filePath || t.path;
				return n ? (n.includes("/") ? n.substring(0, n.lastIndexOf("/")) : "") === e : !1;
			});
		},
		currentSubdirectories() {
			let e = this.currentServerDirectory || "", t = /* @__PURE__ */ new Set();
			return this.serverFiles.forEach((n) => {
				let r = n.filePath || n.path;
				if (!r) return;
				let i = r.includes("/") ? r.substring(0, r.lastIndexOf("/")) : "";
				if (i !== e) {
					if (e === "") {
						if (i) {
							let e = i.indexOf("/");
							e === -1 ? t.add(i) : t.add(i.substring(0, e));
						}
					} else if (i.startsWith(e + "/")) {
						let n = i.substring(e.length + 1), r = n.indexOf("/");
						r === -1 ? t.add(n) : t.add(n.substring(0, r));
					}
				}
			}), Array.from(t).sort();
		},
		currentDirectoryDisplay() {
			return "/data/" + (this.currentServerDirectory ? this.currentServerDirectory + "/" : "");
		},
		canGoBack() {
			return this.currentServerDirectory !== "";
		}
	},
	mounted() {
		this._panelStateChangeListener = (e) => {
			if (e.type === "visibleChange") {
				let t = this.$refs.basePanel || this.$children[0];
				if (t) {
					let n = t.isClosed;
					t.isClosed = e.isClosed, console.log(`[${this.componentName}] 🔔 监听到状态变化: isClosed ${n} -> ${t.isClosed}`), n && !t.isClosed && (t.$forceUpdate(), console.log(`[${this.componentName}] ✅ 强制重新渲染 FunctionPanelUIBase`));
				} else console.warn(`[${this.componentName}] ⚠️ 无法找到 FunctionPanelUIBase 实例`);
			}
		}, Z.addEventListener(this.componentName, this._panelStateChangeListener), console.log(`[${this.componentName}] 📝 已注册面板状态监听器`);
		let e = Z.getPanelState(this.componentName), t = e && e.cesiumTilesets && e.cesiumTilesets.size > 0;
		t && (console.log(`[${this.componentName}] 📦 恢复保存的 Cesium 对象（单例模式）`), this._cesiumTilesets = e.cesiumTilesets, this._cesiumTransforms = e.cesiumTransforms, this._cesiumHeightOffsets = e.cesiumHeightOffsets, this._cesiumErrorHandlers = e.cesiumErrorHandlers, this._cesiumErrorHandlers.forEach((e, t) => {
			e && e.tileset && e.tileset.tileFailed && e.tileset.tileFailed.addEventListener(e.errorHandler);
		}));
		let n = this.lazyLoad || this.getConfigLazyLoad();
		console.log(`[${this.componentName}] 🔍 延迟加载检查:`, {
			thisLazyLoad: this.lazyLoad,
			configLazyLoad: this.getConfigLazyLoad(),
			shouldLazyLoad: n,
			lazyLoadProp: this.$props?.lazyLoad,
			lazyLoadAttr: this.$attrs?.lazyLoad
		}), n ? (console.log(`[${this.componentName}] ⏸️ 延迟加载已启用，等待面板首次打开时加载配置`), console.log(`[${this.componentName}] 📝 延迟加载事件将通过 @lazy-load 监听`)) : console.log(`[${this.componentName}] ⏭️ 延迟加载未启用，将立即加载数据`), this.initCesium(() => {
			n ? console.log(`[${this.componentName}] Cesium 已就绪，等待延迟加载触发`) : (console.log(`[${this.componentName}] Cesium 已就绪，面板初始化完成`), console.log(`[${this.componentName}] 📂 从服务器加载最新配置数据`), this.loadFromJson().then(() => {
				t && (console.log(`[${this.componentName}] 🔄 恢复 Cesium 对象状态`), this.restoreCesiumObjects());
			}).catch((e) => {
				console.error(`[${this.componentName}] ❌ 初始加载失败:`, e), this.obliquePhotographyList = [];
			}));
		});
	},
	beforeUnmount() {
		console.log(`[${this.componentName}] 💾 保存 Cesium 对象到单例管理器`), Z.savePanelState(this.componentName, {
			cesiumTilesets: this._cesiumTilesets,
			cesiumTransforms: this._cesiumTransforms,
			cesiumHeightOffsets: this._cesiumHeightOffsets,
			cesiumErrorHandlers: this._cesiumErrorHandlers,
			obliquePhotographyList: []
		}), this._cesiumErrorHandlers && this._cesiumErrorHandlers.forEach((e, t) => {
			e && e.tileset && e.tileset.tileFailed && e.tileset.tileFailed.removeEventListener(e.errorHandler);
		});
	},
	methods: {
		getConfigLazyLoad() {
			if (typeof window < "u" && window.__functionPanelsConfig__) {
				let e = window.__functionPanelsConfig__.panels.find((e) => e.name === this.componentName);
				return e ? e.lazyLoad === !0 : !1;
			}
			return !1;
		},
		onLazyLoad(e) {
			console.log(`[${this.componentName}] ⚡ 延迟加载触发，首次打开面板`, e);
			let t = Z.getPanelState(this.componentName), n = t && t.cesiumTilesets && t.cesiumTilesets.size > 0;
			this.initCesium(() => {
				console.log(`[${this.componentName}] Cesium 已就绪，开始延迟加载配置`), this.loadFromJson().then(() => {
					n && (console.log(`[${this.componentName}] 🔄 恢复 Cesium 对象状态`), this.restoreCesiumObjects());
				}).catch((e) => {
					console.error(`[${this.componentName}] ❌ 延迟加载失败:`, e), (!this.obliquePhotographyList || this.obliquePhotographyList.length === 0) && (this.obliquePhotographyList = []);
				});
			});
		},
		handleClose() {
			if (console.log(`[${this.componentName}] 面板假关闭（单实例模式）`), typeof window < "u") {
				let e = new CustomEvent("obliquePhotographyPanelFakeClose", { detail: {
					componentName: this.componentName,
					preserveData: !0
				} });
				window.dispatchEvent(e);
			}
			this.$emit("close");
		},
		handleMinimize() {
			console.log(`[${this.componentName}] 面板已最小化`);
		},
		handleExpand() {
			console.log(`[${this.componentName}] 面板已展开`);
		},
		restoreCesiumObjects() {
			let e = this.getCesiumViewer();
			if (!e) {
				console.error(`[${this.componentName}] Cesium Viewer 未初始化，无法恢复 Cesium 对象`);
				return;
			}
			console.log(`[${this.componentName}] 🔄 恢复 Cesium 对象到场景`);
			let t = 0;
			this._cesiumTilesets.forEach((n, r) => {
				if (n && !n.isDestroyed()) {
					e.scene.primitives.contains(n) ? console.log(`[${this.componentName}] ℹ️ tileset 已在场景中: ${r}`) : (e.scene.primitives.add(n), t++, console.log(`[${this.componentName}] ✅ 恢复 tileset: ${r}`));
					let i = this._cesiumTransforms.get(r);
					i && (n.modelMatrix = i);
				}
			}), console.log(`[${this.componentName}] ✅ 恢复完成，共恢复 ${t} 个 tileset`);
		},
		async loadFromJson() {
			try {
				console.log(`[${this.componentName}] 📂 开始加载配置数据: ${Q}`), console.log(`[${this.componentName}] 🔍 当前列表长度: ${this.obliquePhotographyList?.length || 0}`);
				let e = null, t = "";
				try {
					e = await X.loadFromServer(Q), t = "API服务器（数据库）", console.log(`[${this.componentName}] ✅ 从 API 服务器加载数据成功`);
				} catch (n) {
					console.warn(`[${this.componentName}] ⚠️ API 服务器加载失败，尝试静态文件:`, n.message);
					let r = await fetch(ve, { cache: "no-cache" });
					if (!r.ok) throw Error(`HTTP error! status: ${r.status}`);
					e = await r.json(), t = "静态文件", console.log(`[${this.componentName}] ✅ 从静态文件加载数据成功`);
				}
				if (console.log(`[${this.componentName}] 📦 数据来源: ${t}, 原始数据:`, e), !Array.isArray(e)) {
					console.error(`[${this.componentName}] ❌ JSON数据格式错误：期望数组，实际收到:`, typeof e), this.obliquePhotographyList = [];
					return;
				}
				if (e.length === 0) {
					console.warn(`[${this.componentName}] ⚠️ JSON数据为空数组`), this.obliquePhotographyList = [];
					return;
				}
				this.obliquePhotographyList = e.map((e) => {
					let t = this.obliquePhotographyList.find((t) => t.id === e.id);
					return {
						...e,
						loaded: t?.loaded || !1,
						heightOffset: this._cesiumHeightOffsets.get(e.id) || 0,
						loading: !1
					};
				}), console.log(`[${this.componentName}] ✅ 从JSON加载数据成功，共 ${this.obliquePhotographyList.length} 条:`, this.obliquePhotographyList);
			} catch (e) {
				console.error(`[${this.componentName}] ❌ 从JSON加载数据失败:`, e), console.error(`[${this.componentName}] 错误详情:`, {
					message: e.message,
					stack: e.stack,
					name: e.name
				}), this.obliquePhotographyList = [];
			}
		},
		async refreshFromJson() {
			await this.loadFromJson(), console.log(`[${this.componentName}] 数据已刷新`);
		},
		async exportConfig() {
			console.log(`[${this.componentName}] 📤 准备导出配置到服务器`);
			let e = this.obliquePhotographyList.map((e) => ({
				id: e.id,
				name: e.name,
				url: e.url
			})), t = X.validateConfig(Q, e);
			if (!t.valid) return console.error(`[${this.componentName}] ❌ 数据验证失败:`, t.errors), alert(`数据验证失败:\n${t.errors.join("\n")}`), !1;
			let n = await X.uploadToServer(Q, e);
			return n.success ? (console.log(`[${this.componentName}] ✅ 配置已导出到服务器`), alert("配置已成功导出到服务器！\n\n文件：oblique-photography.json\n数据将自动同步到 FTP 目录")) : (console.error(`[${this.componentName}] ❌ 导出失败:`, n.error), alert(`导出失败！\n\n错误：${n.error}\n\n请检查：\n1. API 服务器是否启动（端口 8081）\n2. 网络连接是否正常`)), n.success;
		},
		async saveToJson() {
			try {
				let e = this.obliquePhotographyList.map((e) => ({
					id: e.id,
					name: e.name,
					url: e.url
				})), t = X.validateConfig(Q, e);
				if (!t.valid) return console.error(`[${this.componentName}] ❌ 数据验证失败:`, t.errors), !1;
				let n = await X.uploadToServer(Q, e);
				return n.success ? console.log(`[${this.componentName}] ✅ 配置已自动保存到服务器`) : console.error(`[${this.componentName}] ❌ 自动保存失败:`, n.error), n.success;
			} catch (e) {
				return console.error(`[${this.componentName}] ❌ saveToJson 错误:`, e), !1;
			}
		},
		async openImportDialog() {
			console.log(`[${this.componentName}] 📂 打开服务器文件浏览`), this.showImportDialog = !0, await this.loadServerFiles();
		},
		async importConfig() {
			console.log(`[${this.componentName}] 📥 打开服务器文件导入对话框`), await this.openImportDialog();
		},
		async loadServerFiles(e = "") {
			this.loadingServerFiles = !0;
			try {
				let t = await X.listServerFiles(e), n = await X.getServerDirectoryStructure();
				this.serverFiles = t, this.serverDirectories = n, this.allFilesMap = /* @__PURE__ */ new Map(), t.forEach((e) => {
					let t = e.filePath || e.path;
					t && this.allFilesMap.set(t, e);
				}), console.log(`[${this.componentName}] ✅ 已加载 ${t.length} 个文件，${Object.keys(n).length} 个目录`);
			} catch (e) {
				console.error(`[${this.componentName}] ❌ 加载服务器文件失败:`, e), alert(`加载服务器文件失败！\n\n错误：${e.message}\n\n请检查：\n1. API 服务器是否启动（端口 8081）\n2. 网络连接是否正常`), this.serverFiles = [], this.serverDirectories = {}, this.allFilesMap = /* @__PURE__ */ new Map();
			} finally {
				this.loadingServerFiles = !1;
			}
		},
		navigateToDirectory(e) {
			let t = this.currentServerDirectory ? `${this.currentServerDirectory}/${e}` : e;
			console.log(`[${this.componentName}] 📂 进入目录: ${t}`), this.currentServerDirectory = t;
		},
		navigateToParentDirectory() {
			if (!this.currentServerDirectory) return;
			let e = this.currentServerDirectory.lastIndexOf("/"), t = e === -1 ? "" : this.currentServerDirectory.substring(0, e);
			console.log(`[${this.componentName}] 🔙 返回上级目录: ${t || "(根目录)"}`), this.currentServerDirectory = t;
		},
		async selectServerFile(e) {
			if (!e) {
				this.selectedServerFile = null;
				return;
			}
			let t = e.fileName || e.name, n = e.filePath || e.path;
			console.log(`[${this.componentName}] 📄 选择文件: ${t}`), console.log(`[${this.componentName}] 文件路径: ${n}`), this.selectedServerFile = e;
			let r = `确认导入文件：${t}\n\n这将覆盖当前配置。`;
			if (!confirm(r)) {
				console.log(`[${this.componentName}] ⚠️ 用户取消导入`);
				return;
			}
			let i = await X.loadFromServer(Q);
			if (!i) {
				alert("从服务器加载文件失败！\n\n请检查网络连接");
				return;
			}
			let a = X.validateConfig(Q, i);
			if (!a.valid) {
				alert(`服务器数据验证失败:\n${a.errors.join("\n")}`);
				return;
			}
			this.obliquePhotographyList = i.map((e) => ({
				...e,
				loaded: !1,
				heightOffset: 0,
				loading: !1
			})), console.log(`[${this.componentName}] ✅ 从服务器导入配置成功，共 ${this.obliquePhotographyList.length} 条`), this.closeImportDialog(), alert(`配置已成功从服务器导入！\n\n文件：${t}\n共导入 ${this.obliquePhotographyList.length} 条配置。`);
		},
		closeImportDialog() {
			this.showImportDialog = !1, this.selectedServerFile = null;
		},
		formatDate(e) {
			if (!e) return "未知";
			let t = new Date(e);
			return isNaN(t.getTime()) ? "无效日期" : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
		},
		formatFileSize(e) {
			if (!e || e === 0) return "0 B";
			let t = 1024, n = [
				"B",
				"KB",
				"MB",
				"GB"
			], r = Math.floor(Math.log(e) / Math.log(t));
			return parseFloat((e / t ** r).toFixed(1)) + " " + n[r];
		},
		getConfigStats() {
			let e = this.obliquePhotographyList.map((e) => ({
				id: e.id,
				name: e.name,
				url: e.url
			}));
			return X.getConfigStats(Q, e);
		},
		closeDialog() {
			this.showAddDialog = !1, this.showEditDialog = !1, this.formData = {
				id: "",
				name: "",
				url: ""
			}, this.editingItem = null;
		},
		openEditDialog(e) {
			this.editingItem = e, this.formData = {
				id: e.id,
				name: e.name,
				url: e.url
			}, this.showEditDialog = !0;
		},
		async saveItem() {
			if (!this.formData.id || !this.formData.name || !this.formData.url) {
				alert("请填写所有必填字段");
				return;
			}
			if (this.showEditDialog && this.editingItem) {
				let e = this.obliquePhotographyList.findIndex((e) => e.id === this.editingItem.id);
				e !== -1 && (this.obliquePhotographyList[e] = {
					...this.obliquePhotographyList[e],
					name: this.formData.name,
					url: this.formData.url
				});
			} else {
				if (this.obliquePhotographyList.some((e) => e.id === this.formData.id)) {
					alert("ID已存在，请使用唯一的ID");
					return;
				}
				this.obliquePhotographyList.push({
					id: this.formData.id,
					name: this.formData.name,
					url: this.formData.url,
					loaded: !1,
					heightOffset: 0,
					loading: !1
				});
			}
			await this.saveToJson(), this.closeDialog();
		},
		confirmDelete(e) {
			if (e.loaded) {
				alert("请先卸载倾斜摄影再删除");
				return;
			}
			this.deleteTarget = e, this.showDeleteDialog = !0;
		},
		async executeDelete() {
			if (!this.deleteTarget) return;
			let e = this.obliquePhotographyList.findIndex((e) => e.id === this.deleteTarget.id);
			e !== -1 && (this.obliquePhotographyList.splice(e, 1), await this.saveToJson()), this.showDeleteDialog = !1, this.deleteTarget = null;
		},
		async toggleObliquePhotography(e) {
			if (!this.getCesiumViewer()) {
				console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
				return;
			}
			e.loaded ? await this.unloadObliquePhotography(e) : await this.loadObliquePhotography(e);
		},
		async loadObliquePhotography(e) {
			let t = this.getCesiumViewer(), n = this.getCesium();
			if (!t || !n) {
				console.error(`[${this.componentName}] Cesium 未就绪`);
				return;
			}
			console.log(`[${this.componentName}] 加载倾斜摄影: ${e.name}`);
			let r = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
			r !== -1 && (this.obliquePhotographyList[r].loading = !0, this.obliquePhotographyList = [...this.obliquePhotographyList]);
			try {
				let r = new n.Cesium3DTileset({
					url: e.url,
					show: !0,
					maximumScreenSpaceError: 16,
					skipLevelOfDetail: !0,
					baseScreenSpaceError: 1024,
					skipScreenSpaceErrorFactor: 16,
					skipLevels: 1,
					immediatelyLoadDesiredLevelOfDetail: !1,
					loadSiblings: !1,
					dynamicScreenSpaceError: !0,
					dynamicScreenSpaceErrorDensity: .00278,
					dynamicScreenSpaceErrorFactor: 4,
					dynamicScreenSpaceErrorHeightFalloff: .25,
					debugShowBoundingVolume: !1,
					debugShowContentBoundingVolume: !1,
					debugShowViewerRequestVolume: !1
				});
				this._cesiumTilesets.set(e.id, r), t.scene.primitives.add(r);
				let i = () => {
					if (console.log(`[${this.componentName}] 倾斜摄影加载完成: ${e.name}`), r.boundingSphere) {
						let t = r.boundingSphere;
						console.log(`[${this.componentName}] ${e.name} 边界球:`, {
							中心X: t.center.x.toFixed(2),
							中心Y: t.center.y.toFixed(2),
							中心Z: t.center.z.toFixed(2),
							半径: t.radius.toFixed(2) + "米"
						});
					}
					let i = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
					if (i !== -1 && (this.obliquePhotographyList[i].loading = !1, this.obliquePhotographyList[i].loaded = !0, this.obliquePhotographyList = [...this.obliquePhotographyList]), r.root && r.root.transform) {
						let t = n.Matrix4.clone(r.root.transform);
						this._cesiumTransforms.set(e.id, t);
					}
					r.boundingSphere && (t.camera.flyToBoundingSphere(r.boundingSphere, {
						duration: 2,
						offset: new n.HeadingPitchRange(0, -45, r.boundingSphere.radius * 2)
					}), console.log(`[${this.componentName}] 🎯 已自动定位到 ${e.name}`));
				}, a = (t) => {
					console.error(`[${this.componentName}] 倾斜摄影加载失败: ${e.name}`, t);
					let n = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
					n !== -1 && (this.obliquePhotographyList[n].loading = !1, this.obliquePhotographyList[n].loaded = !1, this.obliquePhotographyList = [...this.obliquePhotographyList]);
				};
				if (r.readyPromise && (typeof Promise < "u" && r.readyPromise instanceof Promise ? r.readyPromise.then(i).catch(a) : typeof r.readyPromise.then == "function" && (r.readyPromise.then(i), typeof r.readyPromise.otherwise == "function" && r.readyPromise.otherwise(a))), this._cesiumErrorHandlers = this._cesiumErrorHandlers || /* @__PURE__ */ new Map(), r.tileFailed) {
					let t = a;
					r.tileFailed.addEventListener(t), this._cesiumErrorHandlers.set(e.id, {
						tileset: r,
						errorHandler: t
					});
				}
			} catch (t) {
				console.error(`[${this.componentName}] 倾斜摄影加载失败: ${e.name}`, t);
				let n = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
				n !== -1 && (this.obliquePhotographyList[n].loading = !1, this.obliquePhotographyList[n].loaded = !1, this.obliquePhotographyList = [...this.obliquePhotographyList]);
			}
		},
		unloadObliquePhotography(e) {
			let t = this.getCesiumViewer();
			if (!t) {
				console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
				return;
			}
			console.log(`[${this.componentName}] 卸载倾斜摄影: ${e.name}`);
			let n = this._cesiumTilesets.get(e.id);
			if (n) try {
				t.scene.primitives.remove(n), this._cesiumTilesets.delete(e.id), this._cesiumTransforms.delete(e.id), this._cesiumHeightOffsets.delete(e.id);
				let r = this._cesiumErrorHandlers?.get(e.id);
				r && r.tileset.tileFailed && (r.tileset.tileFailed.removeEventListener(r.errorHandler), this._cesiumErrorHandlers.delete(e.id));
				let i = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
				i !== -1 && (this.obliquePhotographyList[i].loaded = !1, this.obliquePhotographyList = [...this.obliquePhotographyList]), console.log(`[${this.componentName}] 倾斜摄影已卸载: ${e.name}`);
			} catch (t) {
				console.error(`[${this.componentName}] 倾斜摄影卸载失败: ${e.name}`, t);
			}
		},
		locateToObliquePhotography(e) {
			let t = this.getCesiumViewer(), n = this.getCesium();
			if (!t || !n) {
				console.error(`[${this.componentName}] Cesium 未就绪`);
				return;
			}
			console.log(`[${this.componentName}] 定位到倾斜摄影: ${e.name}`);
			let r = this._cesiumTilesets.get(e.id);
			if (!r || !e.loaded) {
				console.warn(`[${this.componentName}] 倾斜摄影未加载，无法定位: ${e.name}`);
				return;
			}
			try {
				if (r.boundingSphere) {
					let i = r.boundingSphere;
					t.camera.flyToBoundingSphere(i, {
						duration: 2,
						offset: new n.HeadingPitchRange(0, -45, i.radius * 2)
					}), console.log(`[${this.componentName}] 相机已定位到倾斜摄影位置: ${e.name}`);
				}
			} catch (t) {
				console.error(`[${this.componentName}] 定位到倾斜摄影失败: ${e.name}`, t);
			}
		},
		openHeightAdjust(e) {
			this.selectedLayer = e, this.selectedItemId = e.id, this.showHeightPanel = !0;
		},
		onHeightPreview({ layer: e, value: t }) {
			if (!e) return;
			this._cesiumHeightOffsets.set(e.id, t);
			let n = this.obliquePhotographyList.findIndex((t) => t.id === e.id);
			n !== -1 && (this.obliquePhotographyList[n].heightOffset = t, this.obliquePhotographyList = [...this.obliquePhotographyList]);
		},
		onHeightChange({ layer: e, value: t }) {
			e && (this._cesiumHeightOffsets.set(e.id, t), console.log(`[${this.componentName}] ${e.name} 高度偏移调整为: ${t.toFixed(1)} 米`), this.applyObliqueHeightOffset(e));
		},
		applyObliqueHeightOffset(e) {
			let t = this.getCesiumViewer(), n = this.getCesium(), r = this._cesiumTilesets.get(e.id), i = this._cesiumTransforms.get(e.id);
			if (!t || !n || !r || !e.loaded) {
				console.warn(`[${this.componentName}] 倾斜摄影未加载，无法应用高度偏移: ${e.name}`);
				return;
			}
			if (!i) {
				console.warn(`[${this.componentName}] 未找到初始变换矩阵，无法应用相对偏移: ${e.name}`);
				return;
			}
			try {
				if (r.root) {
					let t = n.Matrix4.clone(i), a = this._cesiumHeightOffsets.get(e.id) || 0, o = new n.Cartesian3(0, 0, a), s = n.Matrix4.fromTranslation(o);
					n.Matrix4.multiply(t, s, t), r.root.transform = t, console.log(`[${this.componentName}] ${e.name} 高度偏移已应用`);
				}
			} catch (t) {
				console.error(`[${this.componentName}] 应用高度偏移失败: ${e.name}`, t);
			}
		}
	}
}, be = { class: "toolbar" }, xe = { class: "oblique-list" }, Se = { class: "item-main" }, Ce = { class: "oblique-checkbox" }, we = [
	"checked",
	"onChange",
	"disabled"
], Te = { class: "item-info" }, Ee = { class: "oblique-name" }, De = {
	key: 0,
	class: "loading-text"
}, Oe = {
	key: 1,
	class: "status-text loaded"
}, ke = {
	key: 2,
	class: "status-text unloaded"
}, Ae = { class: "item-actions" }, je = [
	"onClick",
	"disabled",
	"aria-label"
], Me = ["onClick", "aria-label"], Ne = ["onClick", "aria-label"], Pe = ["onClick", "aria-label"], Fe = {
	key: 0,
	class: "empty-state"
}, Ie = { class: "dialog-header" }, Le = { class: "dialog-title" }, Re = { class: "dialog-body" }, ze = { class: "form-group" }, Be = ["disabled"], Ve = { class: "form-group" }, He = { class: "form-group" }, Ue = { class: "dialog-footer" }, We = { class: "dialog-body" }, Ge = { class: "delete-warning" }, Ke = { class: "warning-text" }, qe = { class: "dialog-footer" }, Je = { class: "dialog-header" }, Ye = { class: "dialog-body" }, Xe = { class: "server-info" }, Ze = { class: "server-url" }, Qe = { class: "file-browser" }, $e = { class: "directory-nav" }, et = { class: "nav-path" }, tt = {
	key: 0,
	class: "file-list"
}, $ = ["onClick"], nt = { class: "file-info" }, rt = { class: "file-name" }, it = ["onClick"], at = { class: "file-info" }, ot = { class: "file-name" }, st = { class: "file-path" }, ct = { class: "file-meta" }, lt = { class: "file-size" }, ut = { class: "file-date" }, dt = {
	key: 2,
	class: "empty-state"
}, ft = { class: "dialog-footer" }, pt = ["disabled"];
function mt(u, p, _, x, S, C) {
	let w = m("FunctionPanelUIBase"), T = m("ObliqueHeightAdjustPanel");
	return d(), a(e, null, [
		i(" 主面板 "),
		c(w, {
			ref: "basePanel",
			title: "倾斜摄影加载",
			"title-icon": "📷",
			width: 420,
			"max-height": "70vh",
			"initial-x": _.initialX,
			"initial-y": _.initialY,
			"allow-minimize": !0,
			"registration-key": _.registrationKey || "ObliquePhotographyPanel",
			"panel-instance-id": _.panelInstanceId,
			"auto-register": _.autoRegister === void 0 ? !0 : _.autoRegister,
			"lazy-load": _.lazyLoad || C.getConfigLazyLoad(),
			"close-event-name": "obliquePhotographyPanelClose",
			onClose: C.handleClose,
			onMinimize: C.handleMinimize,
			onExpand: C.handleExpand,
			onLazyLoad: C.onLazyLoad
		}, {
			default: v(() => [
				i(" 工具栏 "),
				o("div", be, [
					o("button", {
						onClick: p[0] ||= (e) => S.showAddDialog = !0,
						class: "tool-btn add-btn",
						title: "添加倾斜摄影数据"
					}, [...p[23] ||= [o("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2"
					}, [o("path", {
						d: "M12 5v14M5 12h14",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					})], -1), s(" 添加 ", -1)]]),
					i(" ⭐ 导出配置到服务器 JSON 文件（通过 HTTP API 写入 SQLite → 自动同步到 FTP 目录） "),
					o("button", {
						onClick: p[1] ||= (...e) => C.exportConfig && C.exportConfig(...e),
						class: "tool-btn export-btn",
						title: "导出配置到服务器 JSON 文件"
					}, [...p[24] ||= [o("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2"
					}, [o("path", {
						d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					})], -1), s(" 导出 ", -1)]]),
					i(" ⭐ 从服务器 JSON 文件导入配置（通过 HTTP API 读取） "),
					o("button", {
						onClick: p[2] ||= (...e) => C.importConfig && C.importConfig(...e),
						class: "tool-btn import-btn",
						title: "从服务器 JSON 文件导入配置"
					}, [...p[25] ||= [o("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2"
					}, [o("path", {
						d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					})], -1), s(" 导入 ", -1)]]),
					i(" ⭐ 从服务器刷新 JSON 数据 "),
					o("button", {
						onClick: p[3] ||= (...e) => C.refreshFromJson && C.refreshFromJson(...e),
						class: "tool-btn refresh-btn",
						title: "从服务器刷新 JSON 数据"
					}, [...p[26] ||= [o("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2"
					}, [o("path", {
						d: "M23 4v6h-6M1 20v-6h6",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					}), o("path", {
						d: "M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					})], -1), s(" 刷新 ", -1)]])
				]),
				i(" 倾斜摄影列表 "),
				o("div", xe, [(d(!0), a(e, null, f(S.obliquePhotographyList, (e) => (d(), a("div", {
					key: e.id,
					class: l(["oblique-item", {
						"is-loaded": e.loaded,
						"is-loading": e.loading,
						"is-selected": S.selectedItemId === e.id
					}])
				}, [
					i(" 复选框和名称 "),
					o("div", Se, [o("label", Ce, [
						o("input", {
							type: "checkbox",
							checked: e.loaded || !1,
							onChange: (t) => C.toggleObliquePhotography(e),
							disabled: e.loading || !1,
							class: "checkbox-input"
						}, null, 40, we),
						p[27] ||= o("span", { class: "check-indicator" }, null, -1),
						o("div", Te, [o("span", Ee, h(e.name || "未知"), 1), e.loading ? (d(), a("span", De, "加载中...")) : e.loaded ? (d(), a("span", Oe, "已加载")) : (d(), a("span", ke, "未加载"))])
					])]),
					i(" 操作按钮组 "),
					o("div", Ae, [
						i(" 定位按钮：始终显示，定位到3D Tiles位置 "),
						o("button", {
							onClick: (t) => C.locateToObliquePhotography(e),
							class: "action-btn locate-btn",
							type: "button",
							disabled: !e.loaded,
							"aria-label": `定位到 ${e.name}`,
							title: "定位到3D Tiles位置"
						}, [...p[28] ||= [o("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						}), o("circle", {
							cx: "12",
							cy: "10",
							r: "3",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1)]], 8, je),
						i(" 高度调整按钮：只在已加载时显示 "),
						e.loaded ? (d(), a("button", {
							key: 0,
							onClick: (t) => C.openHeightAdjust(e),
							class: "action-btn height-btn",
							type: "button",
							"aria-label": `调整 ${e.name} 高度`,
							title: "高度调整"
						}, [...p[29] ||= [o("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M12 19V5M5 12l7-7 7 7",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1)]], 8, Me)) : i("v-if", !0),
						i(" 编辑按钮 "),
						o("button", {
							onClick: (t) => C.openEditDialog(e),
							class: "action-btn edit-btn",
							type: "button",
							"aria-label": `编辑 ${e.name}`,
							title: "编辑"
						}, [...p[30] ||= [o("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						}), o("path", {
							d: "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1)]], 8, Ne),
						i(" 删除按钮 "),
						o("button", {
							onClick: (t) => C.confirmDelete(e),
							class: "action-btn delete-btn",
							type: "button",
							"aria-label": `删除 ${e.name}`,
							title: "删除"
						}, [...p[31] ||= [o("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1)]], 8, Pe)
					])
				], 2))), 128))]),
				i(" 空状态 "),
				S.obliquePhotographyList.length === 0 ? (d(), a("div", Fe, [...p[32] ||= [
					o("svg", {
						class: "empty-icon",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						"stroke-width": "2"
					}, [o("path", {
						d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
						"stroke-linecap": "round",
						"stroke-linejoin": "round"
					})], -1),
					o("div", { class: "empty-title" }, "暂无倾斜摄影数据", -1),
					o("div", { class: "empty-hint" }, "点击\"添加\"按钮导入倾斜摄影配置", -1)
				]])) : i("v-if", !0),
				i(" 添加/编辑对话框 "),
				(d(), r(t, { to: "body" }, [c(n, { name: "dialog-fade" }, {
					default: v(() => [S.showAddDialog || S.showEditDialog ? (d(), a("div", {
						key: 0,
						class: "dialog-overlay",
						onClick: p[11] ||= b((...e) => C.closeDialog && C.closeDialog(...e), ["self"])
					}, [o("div", {
						class: "dialog",
						onClick: p[10] ||= b(() => {}, ["stop"])
					}, [
						o("div", Ie, [o("h3", Le, h(S.showEditDialog ? "编辑倾斜摄影" : "添加倾斜摄影"), 1), o("button", {
							onClick: p[4] ||= (...e) => C.closeDialog && C.closeDialog(...e),
							class: "dialog-close",
							"aria-label": "关闭对话框"
						}, [...p[33] ||= [o("svg", {
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M18 6L6 18M6 6l12 12",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1)]])]),
						o("div", Re, [
							o("div", ze, [p[34] ||= o("label", { class: "form-label" }, [s("ID "), o("span", { class: "required" }, "*")], -1), y(o("input", {
								"onUpdate:modelValue": p[5] ||= (e) => S.formData.id = e,
								type: "text",
								class: "form-input",
								placeholder: "输入唯一标识符",
								disabled: S.showEditDialog
							}, null, 8, Be), [[g, S.formData.id]])]),
							o("div", Ve, [p[35] ||= o("label", { class: "form-label" }, [s("名称 "), o("span", { class: "required" }, "*")], -1), y(o("input", {
								"onUpdate:modelValue": p[6] ||= (e) => S.formData.name = e,
								type: "text",
								class: "form-input",
								placeholder: "输入显示名称"
							}, null, 512), [[g, S.formData.name]])]),
							o("div", He, [p[36] ||= o("label", { class: "form-label" }, [s("URL "), o("span", { class: "required" }, "*")], -1), y(o("textarea", {
								"onUpdate:modelValue": p[7] ||= (e) => S.formData.url = e,
								class: "form-textarea",
								rows: "3",
								placeholder: "输入倾斜摄影数据URL"
							}, null, 512), [[g, S.formData.url]])])
						]),
						o("div", Ue, [o("button", {
							onClick: p[8] ||= (...e) => C.closeDialog && C.closeDialog(...e),
							class: "dialog-btn cancel-btn"
						}, "取消"), o("button", {
							onClick: p[9] ||= (...e) => C.saveItem && C.saveItem(...e),
							class: "dialog-btn confirm-btn"
						}, "保存")])
					])])) : i("v-if", !0)]),
					_: 1
				})])),
				i(" 删除确认对话框 "),
				(d(), r(t, { to: "body" }, [c(n, { name: "dialog-fade" }, {
					default: v(() => [S.showDeleteDialog ? (d(), a("div", {
						key: 0,
						class: "dialog-overlay",
						onClick: p[15] ||= b((e) => S.showDeleteDialog = !1, ["self"])
					}, [o("div", {
						class: "dialog dialog-small",
						onClick: p[14] ||= b(() => {}, ["stop"])
					}, [
						p[38] ||= o("div", { class: "dialog-header" }, [o("h3", { class: "dialog-title" }, "确认删除")], -1),
						o("div", We, [o("div", Ge, [p[37] ||= o("svg", {
							class: "warning-icon",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							"stroke-width": "2"
						}, [o("path", {
							d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
							"stroke-linecap": "round",
							"stroke-linejoin": "round"
						})], -1), o("div", Ke, " 确定要删除 \"" + h(S.deleteTarget?.name) + "\" 吗？此操作无法撤销。 ", 1)])]),
						o("div", qe, [o("button", {
							onClick: p[12] ||= (e) => S.showDeleteDialog = !1,
							class: "dialog-btn cancel-btn"
						}, "取消"), o("button", {
							onClick: p[13] ||= (...e) => C.executeDelete && C.executeDelete(...e),
							class: "dialog-btn danger-btn"
						}, "删除")])
					])])) : i("v-if", !0)]),
					_: 1
				})])),
				i(" ⭐ 服务器文件浏览对话框（导入配置） "),
				(d(), r(t, { to: "body" }, [c(n, { name: "dialog-fade" }, {
					default: v(() => [S.showImportDialog ? (d(), a("div", {
						key: 0,
						class: "dialog-overlay",
						onClick: p[21] ||= b((...e) => C.closeImportDialog && C.closeImportDialog(...e), ["self"])
					}, [o("div", {
						class: "dialog dialog-large",
						onClick: p[20] ||= b(() => {}, ["stop"])
					}, [
						o("div", Je, [p[39] ||= o("h3", { class: "dialog-title" }, "📂 从服务器导入配置", -1), o("button", {
							onClick: p[16] ||= (...e) => C.closeImportDialog && C.closeImportDialog(...e),
							class: "close-btn",
							"aria-label": "关闭"
						}, "×")]),
						o("div", Ye, [
							i(" 服务器信息 "),
							o("div", Xe, [p[40] ||= o("span", { class: "server-label" }, "服务器：", -1), o("span", Ze, h(S.apiServerURL), 1)]),
							i(" 文件列表 "),
							o("div", Qe, [
								i(" 目录导航 "),
								o("div", $e, [
									C.canGoBack ? (d(), a("button", {
										key: 0,
										onClick: p[17] ||= (...e) => C.navigateToParentDirectory && C.navigateToParentDirectory(...e),
										class: "nav-btn back-btn",
										title: "返回上级目录"
									}, [...p[41] ||= [o("svg", {
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "currentColor",
										"stroke-width": "2"
									}, [o("path", {
										d: "M19 12H5M12 19l-7-7 7-7",
										"stroke-linecap": "round",
										"stroke-linejoin": "round"
									})], -1), s(" 返回 ", -1)]])) : i("v-if", !0),
									p[42] ||= o("span", { class: "nav-label" }, "目录：", -1),
									o("span", et, h(C.currentDirectoryDisplay), 1)
								]),
								i(" 子目录列表 "),
								S.loadingServerFiles ? (d(), a(e, { key: 1 }, [i(" 加载状态 "), p[48] ||= o("div", { class: "file-list loading" }, [o("div", { class: "loading-spinner" }), o("p", null, "正在加载服务器文件...")], -1)], 2112)) : (d(), a("div", tt, [
									i(" 子目录 "),
									(d(!0), a(e, null, f(C.currentSubdirectories, (e) => (d(), a("div", {
										key: "dir-" + e,
										class: "file-item directory-item",
										onClick: (t) => C.navigateToDirectory(e)
									}, [
										p[44] ||= o("div", { class: "file-icon" }, "📁", -1),
										o("div", nt, [o("div", rt, h(e), 1), p[43] ||= o("div", { class: "file-path" }, "目录", -1)]),
										p[45] ||= o("div", { class: "file-action" }, "📂", -1)
									], 8, $))), 128)),
									i(" 文件 "),
									(d(!0), a(e, null, f(C.currentDirectoryFiles, (e) => (d(), a("div", {
										key: e.path || e.filePath,
										class: l(["file-item", { "is-selected": S.selectedServerFile === e }]),
										onClick: (t) => C.selectServerFile(e)
									}, [
										p[46] ||= o("div", { class: "file-icon" }, "📄", -1),
										o("div", at, [
											o("div", ot, h(e.fileName || e.name), 1),
											o("div", st, h(e.filePath || e.path), 1),
											o("div", ct, [o("span", lt, h(C.formatFileSize(e.fileSize || e.size)), 1), o("span", ut, h(C.formatDate(e.modifiedTime || e.modified)), 1)])
										]),
										p[47] ||= o("div", { class: "file-action" }, "📥", -1)
									], 10, it))), 128))
								])),
								i(" 空状态 "),
								!S.loadingServerFiles && S.serverFiles.length === 0 ? (d(), a("div", dt, [...p[49] ||= [
									o("div", { class: "empty-icon" }, "📁", -1),
									o("div", { class: "empty-title" }, "服务器上没有找到配置文件", -1),
									o("div", { class: "empty-hint" }, "请确保 API 服务器已启动", -1)
								]])) : i("v-if", !0)
							])
						]),
						o("div", ft, [o("button", {
							onClick: p[18] ||= (...e) => C.closeImportDialog && C.closeImportDialog(...e),
							class: "dialog-btn cancel-btn"
						}, "取消"), o("button", {
							onClick: p[19] ||= (e) => C.loadServerFiles(),
							class: "dialog-btn secondary-btn",
							disabled: S.loadingServerFiles
						}, " 🔄 刷新 ", 8, pt)])
					])])) : i("v-if", !0)]),
					_: 1
				})]))
			]),
			_: 1
		}, 8, [
			"initial-x",
			"initial-y",
			"registration-key",
			"panel-instance-id",
			"auto-register",
			"lazy-load",
			"onClose",
			"onMinimize",
			"onExpand",
			"onLazyLoad"
		]),
		i(" 高度调整面板（独立渲染，避免嵌套Teleport冲突） "),
		(d(), r(t, { to: "body" }, [c(n, { name: "height-panel-fade" }, {
			default: v(() => [S.showHeightPanel && S.selectedLayer ? (d(), r(T, {
				key: 0,
				"initial-x": C.computedHeightPanelX,
				"initial-y": _.initialY,
				"selected-layer": S.selectedLayer,
				onClose: p[22] ||= (e) => S.showHeightPanel = !1,
				onHeightPreview: C.onHeightPreview,
				onHeightChange: C.onHeightChange
			}, null, 8, [
				"initial-x",
				"initial-y",
				"selected-layer",
				"onHeightPreview",
				"onHeightChange"
			])) : i("v-if", !0)]),
			_: 1
		})]))
	], 64);
}
var ht = /*#__PURE__*/ w(ye, [["render", mt], ["__scopeId", "data-v-3d58609d"]]);
//#endregion
export { ht as default };
