if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./RangeCoder/BitTreeDecoder','./RangeCoder/BitTreeEncoder','./RangeCoder/Decoder','./RangeCoder/Encoder'],function(BitTreeDecoder,BitTreeEncoder,Decoder,Encoder){
  'use strict';
  return {
    BitTreeDecoder: BitTreeDecoder,
    BitTreeEncoder: BitTreeEncoder,
    Decoder: Decoder,
    Encoder: Encoder
  };
});
