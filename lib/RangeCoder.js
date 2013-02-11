if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./RangeCoder/Decoder','./RangeCoder/Encoder'],function(Decoder,Encoder){
  'use strict';
  return {
    Decoder: Decoder,
    Encoder: Encoder
  };
});
