/* This file is automatically rebuilt by the Cesium build process. */
define(['./Cartesian2-b83e6941', './when-f31b6bd1', './EllipseOutlineGeometry-afac8786', './Check-285f6bfc', './Math-0cb8fde5', './GeometryOffsetAttribute-4b098ee5', './Transforms-5f6ace66', './RuntimeError-c7c236f3', './ComponentDatatype-d4a0149c', './WebGLConstants-34c08bc0', './EllipseGeometryLibrary-6188a458', './GeometryAttribute-86e14a55', './GeometryAttributes-e973821e', './IndexDatatype-e9409feb'], function (Cartesian2, when, EllipseOutlineGeometry, Check, _Math, GeometryOffsetAttribute, Transforms, RuntimeError, ComponentDatatype, WebGLConstants, EllipseGeometryLibrary, GeometryAttribute, GeometryAttributes, IndexDatatype) { 'use strict';

  function createEllipseOutlineGeometry(ellipseGeometry, offset) {
    if (when.defined(offset)) {
      ellipseGeometry = EllipseOutlineGeometry.EllipseOutlineGeometry.unpack(ellipseGeometry, offset);
    }
    ellipseGeometry._center = Cartesian2.Cartesian3.clone(ellipseGeometry._center);
    ellipseGeometry._ellipsoid = Cartesian2.Ellipsoid.clone(ellipseGeometry._ellipsoid);
    return EllipseOutlineGeometry.EllipseOutlineGeometry.createGeometry(ellipseGeometry);
  }

  return createEllipseOutlineGeometry;

});
