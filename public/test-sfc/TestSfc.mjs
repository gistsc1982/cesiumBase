import { Fragment as e, createCommentVNode as t, createElementBlock as n, createElementVNode as r, normalizeClass as i, normalizeStyle as a, openBlock as o, toDisplayString as s, vModelText as c, withDirectives as l } from "vue";
//#region \0plugin-vue:export-helper
var u = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, d = {
	name: "SfcBase",
	props: { onClose: {
		type: Function,
		default: null
	} },
	inject: {
		closeEventName: { default: "sfcBaseClose" },
		instanceId: { default: 1 }
	},
	data() {
		return {
			cesiumReady: !1,
			cesiumCheckInterval: null,
			componentName: "SfcBase",
			boundEventHandlers: {}
		};
	},
	methods: {
		checkCesiumReady() {
			return typeof window < "u" && window.Cesium !== void 0 && window.__cesiumViewer__ ? (this.cesiumReady = !0, this.$logger?.info?.("[SfcBase] Cesium 已就绪"), !0) : !1;
		},
		waitForCesium(e, t = 50, n = 100) {
			let r = 0;
			this.cesiumCheckInterval && clearInterval(this.cesiumCheckInterval), this.cesiumCheckInterval = setInterval(() => {
				r++, this.checkCesiumReady() ? (clearInterval(this.cesiumCheckInterval), this.cesiumCheckInterval = null, e && typeof e == "function" && e()) : r >= t && (clearInterval(this.cesiumCheckInterval), this.cesiumCheckInterval = null, this.$logger?.warn?.(`[${this.componentName}] Cesium 初始化超时`));
			}, n);
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
			this.$logger = this.createLogger(), this.$logger?.info?.("组件初始化"), this.checkCesiumReady() ? e && e() : (this.$logger?.info?.("等待 Cesium 初始化..."), this.waitForCesium(() => {
				this.$logger?.info?.("Cesium 已就绪"), e && e();
			}));
		},
		cleanup() {
			this.cesiumCheckInterval &&= (clearInterval(this.cesiumCheckInterval), null), this.clearBoundHandlers(), this.$logger?.info?.("资源已清理");
		}
	},
	mounted() {},
	beforeUnmount() {
		this.cleanup();
	}
}, f = {
	class: "sfc-base",
	style: { display: "none" }
};
function p(i, a, s, c, l, u) {
	return o(), n(e, null, [t(" 基础组件无界面元素，仅作为逻辑基类 "), r("div", f)], 2112);
}
//#endregion
//#region src/components/TestSfc.vue
var m = {
	name: "TestSfc",
	mixins: [/* @__PURE__ */ u(d, [["render", p]])],
	props: { onClose: {
		type: Function,
		default: null
	} },
	inject: {
		closeEventName: { default: "testSfcClose" },
		instanceId: { default: 1 }
	},
	data() {
		return {
			componentName: "TestSfc",
			longitude: 0,
			latitude: 0,
			height: 1e3,
			pitch: -45,
			locateMessage: "",
			messageType: "info",
			position: {
				x: "auto",
				y: 0
			},
			right: 20,
			isDragging: !1,
			dragStart: {
				x: 0,
				y: 0
			},
			initialPosition: {
				x: 0,
				y: 0
			},
			boundOnDrag: null,
			boundStopDrag: null
		};
	},
	methods: {
		executeLocate() {
			if (!this.checkCesiumReady()) {
				this.showMessage("Cesium 未就绪，无法定位", "error");
				return;
			}
			this.showMessage("正在定位...", "info"), this.flyToPosition(this.longitude, this.latitude, this.height, {
				heading: 0,
				pitch: Cesium.Math.toRadians(this.pitch || -45),
				roll: 0
			}, 2).then(() => {
				this.showMessage(`定位成功: 经度 ${this.longitude.toFixed(6)}, 纬度 ${this.latitude.toFixed(6)}`, "success");
			}).catch((e) => {
				this.showMessage("定位失败: " + e.message, "error");
			});
		},
		handleLocate() {
			let e = this.validateLonLat(this.longitude, this.latitude, this.height);
			if (!e.valid) {
				this.showMessage(e.message, "error");
				return;
			}
			if (!this.checkCesiumReady()) {
				this.showMessage("等待 Cesium 初始化...", "info"), this.waitForCesium(() => {
					this.executeLocate();
				}, 20);
				return;
			}
			this.executeLocate();
		},
		showMessage(e, t = "info", n = 3e3) {
			this.$logger?.info?.(`[${this.componentName}] ${t.toUpperCase()}: ${e}`), this.locateMessage = e, this.messageType = t, n > 0 && typeof this.clearMessage == "function" && setTimeout(() => this.clearMessage(), n);
		},
		clearMessage() {
			this.locateMessage = "";
		},
		handleClose() {
			if (typeof window < "u") {
				let e = new CustomEvent(this.closeEventName, { detail: {
					componentName: this.componentName,
					instanceId: this.instanceId
				} });
				window.dispatchEvent(e), this.onClose && typeof this.onClose == "function" && this.onClose(), this.$logger?.info?.(`[${this.componentName}] 关闭事件已触发`);
			}
			typeof window < "u" && this.closeEventName === "testSfcClose" && window.__testSfcOnClose && typeof window.__testSfcOnClose == "function" && window.__testSfcOnClose();
		},
		startDrag(e) {
			if (e.button === 0 && !e.target.closest(".close-btn")) {
				if (this.isDragging = !0, this.dragStart = {
					x: e.clientX,
					y: e.clientY
				}, this.position.x === "auto") {
					let e = this.$refs.modalRef.getBoundingClientRect();
					this.initialPosition = {
						x: e.left,
						y: e.top
					};
				} else this.initialPosition = { ...this.position };
				this.boundOnDrag = this.bindEventHandler("onDrag", this.onDrag), this.boundStopDrag = this.bindEventHandler("stopDrag", this.stopDrag), document.addEventListener("mousemove", this.boundOnDrag), document.addEventListener("mouseup", this.boundStopDrag), e.preventDefault();
			}
		},
		onDrag(e) {
			if (!this.isDragging) return;
			let t = e.clientX - this.dragStart.x, n = e.clientY - this.dragStart.y, r = this.initialPosition.x + t, i = this.initialPosition.y + n, a = window.innerWidth - 350, o = window.innerHeight - 200;
			r = Math.max(0, Math.min(r, a)), i = Math.max(0, Math.min(i, o)), this.position = {
				x: r,
				y: i
			};
		},
		stopDrag() {
			this.isDragging && (this.isDragging = !1, this.boundOnDrag && document.removeEventListener("mousemove", this.boundOnDrag), this.boundStopDrag && document.removeEventListener("mouseup", this.boundStopDrag));
		}
	},
	mounted() {
		this.initCesium(() => {
			let e = (this.instanceId - 1) * 30;
			this.right = 20 + e, this.position.y = 100 + e;
		});
	},
	beforeUnmount() {
		this.isDragging && (this.boundOnDrag && document.removeEventListener("mousemove", this.boundOnDrag), this.boundStopDrag && document.removeEventListener("mouseup", this.boundStopDrag)), this.cleanup();
	}
}, h = { class: "test-sfc-body" }, g = { class: "location-form" }, _ = { class: "form-group" }, v = { class: "form-group" }, y = { class: "form-group" }, b = { class: "form-group" };
function x(e, u, d, f, p, m) {
	return o(), n("div", {
		class: i(["test-sfc-modal", { "is-dragging": p.isDragging }]),
		style: a({
			left: p.position.x === "auto" ? "auto" : p.position.x + "px",
			top: p.position.y + "px",
			right: p.position.x === "auto" ? p.right + "px" : "auto"
		}),
		ref: "modalRef"
	}, [r("div", {
		class: i(["test-sfc-header", { dragging: p.isDragging }]),
		onMousedown: u[1] ||= (...e) => m.startDrag && m.startDrag(...e)
	}, [u[7] ||= r("h3", null, "🧪 TestSfc 测试组件", -1), r("button", {
		onClick: u[0] ||= (...e) => m.handleClose && m.handleClose(...e),
		class: "close-btn"
	}, "×")], 34), r("div", h, [r("div", g, [
		r("div", _, [u[8] ||= r("label", { class: "form-label" }, [r("span", { class: "label-icon" }, "📍"), r("span", null, "经度")], -1), l(r("input", {
			"onUpdate:modelValue": u[2] ||= (e) => p.longitude = e,
			type: "number",
			step: "0.000001",
			min: "-180",
			max: "180",
			class: "form-input",
			placeholder: "输入经度 (-180 ~ 180)"
		}, null, 512), [[
			c,
			p.longitude,
			void 0,
			{ number: !0 }
		]])]),
		r("div", v, [u[9] ||= r("label", { class: "form-label" }, [r("span", { class: "label-icon" }, "🌐"), r("span", null, "纬度")], -1), l(r("input", {
			"onUpdate:modelValue": u[3] ||= (e) => p.latitude = e,
			type: "number",
			step: "0.000001",
			min: "-90",
			max: "90",
			class: "form-input",
			placeholder: "输入纬度 (-90 ~ 90)"
		}, null, 512), [[
			c,
			p.latitude,
			void 0,
			{ number: !0 }
		]])]),
		r("div", y, [u[10] ||= r("label", { class: "form-label" }, [r("span", { class: "label-icon" }, "🔭"), r("span", null, "高度")], -1), l(r("input", {
			"onUpdate:modelValue": u[4] ||= (e) => p.height = e,
			type: "number",
			step: "0.1",
			class: "form-input",
			placeholder: "输入高度 (米)"
		}, null, 512), [[
			c,
			p.height,
			void 0,
			{ number: !0 }
		]])]),
		r("div", b, [u[11] ||= r("label", { class: "form-label" }, [r("span", { class: "label-icon" }, "⤵"), r("span", null, "俯仰角")], -1), l(r("input", {
			"onUpdate:modelValue": u[5] ||= (e) => p.pitch = e,
			type: "number",
			step: "0.1",
			min: "-90",
			max: "0",
			class: "form-input",
			placeholder: "俯仰角 (-90 ~ 0)"
		}, null, 512), [[
			c,
			p.pitch,
			void 0,
			{ number: !0 }
		]])]),
		r("button", {
			onClick: u[6] ||= (...e) => m.handleLocate && m.handleLocate(...e),
			class: "locate-btn"
		}, [...u[12] ||= [r("span", { class: "btn-icon" }, "🎯", -1), r("span", null, "定位", -1)]]),
		p.locateMessage ? (o(), n("div", {
			key: 0,
			class: i(["locate-message", p.messageType])
		}, s(p.locateMessage), 3)) : t("v-if", !0)
	])])], 6);
}
var S = /*#__PURE__*/ u(m, [["render", x]]);
//#endregion
export { S as default };
