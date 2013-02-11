if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./freeze', './LZMA/Decoder'],function(freeze, Decoder){
  'use strict';
  return freeze({
    Decoder: Decoder
  });
});
