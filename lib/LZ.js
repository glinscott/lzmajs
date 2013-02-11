if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./LZ/InWindow','./LZ/OutWindow'],function(InWindow,OutWindow){
  'use strict';
  return {
    InWindow: InWindow,
    OutWindow: OutWindow
  };
});
