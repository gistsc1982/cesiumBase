/* This file is automatically rebuilt by the Cesium build process. */
define(['./CylinderGeometry-9f641a65', './when-f31b6bd1', './GeometryOffsetAttribute-4b098ee5', './Check-285f6bfc', './Transforms-5f6ace66', './Cartesian2-b83e6941', './Math-0cb8fde5', './RuntimeError-c7c236f3', './ComponentDatatype-d4a0149c', './WebGLConstants-34c08bc0', './CylinderGeometryLibrary-80082e19', './GeometryAttribute-86e14a55', './GeometryAttributes-e973821e', './IndexDatatype-e9409feb', './VertexFormat-ab7dd48c'], function (CylinderGeometry, when, GeometryOffsetAttribute, Check, Transforms, Cartesian2, _Math, RuntimeError, ComponentDatatype, WebGLConstants, CylinderGeometryLibrary, GeometryAttribute, GeometryAttributes, IndexDatatype, VertexFormat) { 'use strict';

  function createCylinderGeometry(cylinderGeometry, offset) {
    if (when.defined(offset)) {
      cylinderGeometry = CylinderGeometry.CylinderGeometry.unpack(cylinderGeometry, offset);
    }
    return CylinderGeometry.CylinderGeometry.createGeometry(cylinderGeometry);
  }

  return createCylinderGeometry;

});
