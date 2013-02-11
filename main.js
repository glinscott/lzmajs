if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./lib/freeze', './lib/encoder', './lib/LZ', './lib/LZMA', './lib/RangeCoder', './lib/Util'], function(freeze, Encoder, LZ, LZMA, RangeCoder, Util) {
  'use strict';

  return freeze({
        version: "0.9.0",
        Encoder: Encoder,
        LZ: LZ,
        LZMA: LZMA,
        RangeCoder: RangeCoder,
        Util: Util,
        // utility methods
        decompress: Util.decompress,
        decompressFile: Util.decompressFile
  });
});
