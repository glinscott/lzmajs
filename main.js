if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./lib/freeze', './lib/LZ', './lib/LZMA', './lib/RangeCoder', './lib/Util'], function(freeze, LZ, LZMA, RangeCoder, Util) {
  'use strict';

  return freeze({
        version: "0.9.0",
        LZ: LZ,
        LZMA: LZMA,
        RangeCoder: RangeCoder,
        Util: Util,
        // utility methods
        decompress: Util.decompress,
        decompressFile: Util.decompressFile
  });
});
