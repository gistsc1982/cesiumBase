/* This file is automatically rebuilt by the Cesium build process. */
define(['./Cartesian2-b83e6941', './when-f31b6bd1', './EllipseGeometry-57ed03ce', './Check-285f6bfc', './Math-0cb8fde5', './GeometryOffsetAttribute-4b098ee5', './Transforms-5f6ace66', './RuntimeError-c7c236f3', './ComponentDatatype-d4a0149c', './WebGLConstants-34c08bc0', './EllipseGeometryLibrary-6188a458', './GeometryAttribute-86e14a55', './GeometryAttributes-e973821e', './GeometryInstance-bedf45af', './GeometryPipeline-9072a836', './AttributeCompression-2b8069f2', './EncodedCartesian3-3d79976e', './IndexDatatype-e9409feb', './IntersectionTests-04e881dc', './Plane-0dcb3991', './VertexFormat-ab7dd48c'], function (Cartesian2, when, EllipseGeometry, Check, _Math, GeometryOffsetAttribute, Transforms, RuntimeError, ComponentDatatype, WebGLConstants, EllipseGeometryLibrary, GeometryAttribute, GeometryAttributes, GeometryInstance, GeometryPipeline, AttributeCompression, EncodedCartesian3, IndexDatatype, IntersectionTests, Plane, VertexFormat) { 'use strict';

  function createEllipseGeometry(ellipseGeometry, offset) {
    if (when.defined(offset)) {
      ellipseGeometry = EllipseGeometry.EllipseGeometry.unpack(ellipseGeometry, offset);
    }
    ellipseGeometry._center = Cartesian2.Cartesian3.clone(ellipseGeometry._center);
    ellipseGeometry._ellipsoid = Cartesian2.Ellipsoid.clone(ellipseGeometry._ellipsoid);
    return EllipseGeometry.EllipseGeometry.createGeometry(ellipseGeometry);
  }

  return createEllipseGeometry;

});
