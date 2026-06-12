//This file is automatically rebuilt by the Cesium build process.
export default "#ifndef LOG_DEPTH\n\
varying float v_WindowZ;\n\
#endif\n\
vec4 czm_depthClamp(vec4 coords)\n\
{\n\
#ifndef LOG_DEPTH\n\
v_WindowZ = (0.5 * (coords.z / coords.w) + 0.5) * coords.w;\n\
coords.z = clamp(coords.z, -coords.w, +coords.w);\n\
#endif\n\
return coords;\n\
}\n\
";
