import { createCommentVNode as e, createElementBlock as t, createElementVNode as n, normalizeClass as r, normalizeStyle as i, openBlock as a, toDisplayString as o, vModelText as s, withDirectives as c } from "vue";
//#region \0plugin-vue:export-helper
var l = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, u = {
	name: "TestSfc",
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
			longitude: 0,
			latitude: 0,
			height: 1e3,
			pitch: -45,
			locateMessage: "",
			messageType: "info",
			cesiumReady: !1,
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
		handleLocate() {
			if (!this.isValidCoordinate(this.longitude, -180, 180)) {
				this.showMessage("经度必须在 -180 到 180 之间", "error");
				return;
			}
			if (!this.isValidCoordinate(this.latitude, -90, 90)) {
				this.showMessage("纬度必须在 -90 到 90 之间", "error");
				return;
			}
			if (!this.isValidCoordinate(this.height, -1e3, 1e5)) {
				this.showMessage("高度必须在合理范围内", "error");
				return;
			}
			if (!this.checkCesiumReady()) {
				this.showMessage("等待 Cesium 初始化...", "info"), console.log("[TestSfc] 等待 Cesium 初始化..."), this.waitForCesium(() => {
					this.executeLocate();
				}, 20);
				return;
			}
			this.executeLocate();
		},
		executeLocate() {
			if (!this.checkCesiumReady()) {
				this.showMessage("Cesium 未就绪，无法定位", "error"), console.warn("[TestSfc] window.__cesiumViewer__ 仍然不可用"), console.log("[TestSfc] window.Cesium:", typeof window < "u" ? typeof window.Cesium : "undefined"), console.log("[TestSfc] window.__cesiumViewer__:", typeof window < "u" ? window.__cesiumViewer__ : "undefined");
				return;
			}
			this.showMessage("正在定位...", "info");
			try {
				let e = window.__cesiumViewer__, t = Cesium.Cartesian3.fromDegrees(this.longitude, this.latitude, this.height);
				e.camera.flyTo({
					destination: t,
					orientation: {
						heading: Cesium.Math.toRadians(0),
						pitch: Cesium.Math.toRadians(this.pitch || -45),
						roll: 0
					},
					duration: 2
				}), this.showMessage(`定位成功: 经度 ${this.longitude.toFixed(6)}, 纬度 ${this.latitude.toFixed(6)}`, "success");
			} catch (e) {
				console.error("[TestSfc] 定位失败:", e), this.showMessage("定位失败: " + e.message, "error");
			}
		},
		isValidCoordinate(e, t, n) {
			return typeof e == "number" && !isNaN(e) && e >= t && e <= n;
		},
		showMessage(e, t = "info") {
			this.locateMessage = e, this.messageType = t, setTimeout(() => {
				this.locateMessage = "";
			}, 3e3);
		},
		checkCesiumReady() {
			return typeof window < "u" && window.Cesium !== void 0 && window.__cesiumViewer__ ? (this.cesiumReady = !0, console.log("[TestSfc] Cesium 已就绪"), !0) : !1;
		},
		waitForCesium(e, t = 50) {
			let n = 0, r = setInterval(() => {
				n++, this.checkCesiumReady() ? (clearInterval(r), e && e()) : n >= t && (clearInterval(r), console.warn("[TestSfc] Cesium 初始化超时"));
			}, 100);
		},
		handleClose() {
			if (typeof window < "u") {
				let e = new CustomEvent(this.closeEventName);
				window.dispatchEvent(e), this.closeEventName === "testSfcClose" && window.__testSfcOnClose && typeof window.__testSfcOnClose == "function" && window.__testSfcOnClose();
			}
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
				document.addEventListener("mousemove", this.boundOnDrag), document.addEventListener("mouseup", this.boundStopDrag), e.preventDefault();
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
			this.isDragging && (this.isDragging = !1, document.removeEventListener("mousemove", this.boundOnDrag), document.removeEventListener("mouseup", this.boundStopDrag));
		}
	},
	mounted() {
		console.log("[TestSfc] 组件已挂载");
		let e = (this.instanceId - 1) * 30;
		this.right = 20 + e, this.position.y = 100 + e, this.checkCesiumReady(), this.cesiumReady || (console.log("[TestSfc] 等待 Cesium 初始化..."), this.waitForCesium()), this.boundOnDrag = this.onDrag.bind(this), this.boundStopDrag = this.stopDrag.bind(this);
	},
	beforeUnmount() {
		this.isDragging && (document.removeEventListener("mousemove", this.boundOnDrag), document.removeEventListener("mouseup", this.boundStopDrag));
	}
}, d = { class: "test-sfc-body" }, f = { class: "location-form" }, p = { class: "form-group" }, m = { class: "form-group" }, h = { class: "form-group" }, g = { class: "form-group" };
function _(l, u, _, v, y, b) {
	return a(), t("div", {
		class: r(["test-sfc-modal", { "is-dragging": y.isDragging }]),
		style: i({
			left: y.position.x === "auto" ? "auto" : y.position.x + "px",
			top: y.position.y + "px",
			right: y.position.x === "auto" ? y.right + "px" : "auto"
		}),
		ref: "modalRef"
	}, [n("div", {
		class: r(["test-sfc-header", { dragging: y.isDragging }]),
		onMousedown: u[1] ||= (...e) => b.startDrag && b.startDrag(...e)
	}, [u[7] ||= n("h3", null, "🧪 TestSfc 测试组件", -1), n("button", {
		onClick: u[0] ||= (...e) => b.handleClose && b.handleClose(...e),
		class: "close-btn"
	}, "×")], 34), n("div", d, [n("div", f, [
		n("div", p, [u[8] ||= n("label", { class: "form-label" }, [n("span", { class: "label-icon" }, "📍"), n("span", null, "经度")], -1), c(n("input", {
			"onUpdate:modelValue": u[2] ||= (e) => y.longitude = e,
			type: "number",
			step: "0.000001",
			min: "-180",
			max: "180",
			class: "form-input",
			placeholder: "输入经度 (-180 ~ 180)"
		}, null, 512), [[
			s,
			y.longitude,
			void 0,
			{ number: !0 }
		]])]),
		n("div", m, [u[9] ||= n("label", { class: "form-label" }, [n("span", { class: "label-icon" }, "🌐"), n("span", null, "纬度")], -1), c(n("input", {
			"onUpdate:modelValue": u[3] ||= (e) => y.latitude = e,
			type: "number",
			step: "0.000001",
			min: "-90",
			max: "90",
			class: "form-input",
			placeholder: "输入纬度 (-90 ~ 90)"
		}, null, 512), [[
			s,
			y.latitude,
			void 0,
			{ number: !0 }
		]])]),
		n("div", h, [u[10] ||= n("label", { class: "form-label" }, [n("span", { class: "label-icon" }, "🔭"), n("span", null, "高度")], -1), c(n("input", {
			"onUpdate:modelValue": u[4] ||= (e) => y.height = e,
			type: "number",
			step: "0.1",
			class: "form-input",
			placeholder: "输入高度 (米)"
		}, null, 512), [[
			s,
			y.height,
			void 0,
			{ number: !0 }
		]])]),
		n("div", g, [u[11] ||= n("label", { class: "form-label" }, [n("span", { class: "label-icon" }, "⤵"), n("span", null, "俯仰角")], -1), c(n("input", {
			"onUpdate:modelValue": u[5] ||= (e) => y.pitch = e,
			type: "number",
			step: "0.1",
			min: "-90",
			max: "0",
			class: "form-input",
			placeholder: "俯仰角 (-90 ~ 0)"
		}, null, 512), [[
			s,
			y.pitch,
			void 0,
			{ number: !0 }
		]])]),
		n("button", {
			onClick: u[6] ||= (...e) => b.handleLocate && b.handleLocate(...e),
			class: "locate-btn"
		}, [...u[12] ||= [n("span", { class: "btn-icon" }, "🎯", -1), n("span", null, "定位", -1)]]),
		y.locateMessage ? (a(), t("div", {
			key: 0,
			class: r(["locate-message", y.messageType])
		}, o(y.locateMessage), 3)) : e("", !0)
	])])], 6);
}
var v = /*#__PURE__*/ l(u, [["render", _]]);
//#endregion
export { v as default };
