/* This file is automatically rebuilt by the Cesium build process. */
define(['./PrimitivePipeline-4c782330', './createTaskProcessorWorker', './Transforms-5f6ace66', './Cartesian2-b83e6941', './Check-285f6bfc', './when-f31b6bd1', './Math-0cb8fde5', './RuntimeError-c7c236f3', './ComponentDatatype-d4a0149c', './WebGLConstants-34c08bc0', './GeometryAttribute-86e14a55', './GeometryAttributes-e973821e', './GeometryPipeline-9072a836', './AttributeCompression-2b8069f2', './EncodedCartesian3-3d79976e', './IndexDatatype-e9409feb', './IntersectionTests-04e881dc', './Plane-0dcb3991', './WebMercatorProjection-7a7aab61'], function (PrimitivePipeline, createTaskProcessorWorker, Transforms, Cartesian2, Check, when, _Math, RuntimeError, ComponentDatatype, WebGLConstants, GeometryAttribute, GeometryAttributes, GeometryPipeline, AttributeCompression, EncodedCartesian3, IndexDatatype, IntersectionTests, Plane, WebMercatorProjection) { 'use strict';

  function combineGeometry(packedParameters, transferableObjects) {
    var parameters = PrimitivePipeline.PrimitivePipeline.unpackCombineGeometryParameters(
      packedParameters
    );
    var results = PrimitivePipeline.PrimitivePipeline.combineGeometry(parameters);
    return PrimitivePipeline.PrimitivePipeline.packCombineGeometryResults(
      results,
      transferableObjects
    );
  }
  var combineGeometry$1 = createTaskProcessorWorker(combineGeometry);

  return combineGeometry$1;

});
