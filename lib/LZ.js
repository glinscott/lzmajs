if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./LZ/BinTree','./LZ/InWindow','./LZ/OutWindow'],function(BinTree,InWindow,OutWindow){
  'use strict';
  return {
    BinTree: BinTree,
    InWindow: InWindow,
    OutWindow: OutWindow
  };
});
