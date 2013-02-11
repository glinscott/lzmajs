if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./lib/encoder', './lib/LZ', './lib/lzma', './lib/RangeCoder'], function(Encoder, LZ, LZMA, RangeCoder) {
'use strict';

    return {
        version: "0.9.0",
        Encoder: Encoder,
        LZ: LZ,
        LZMA: LZMA,
        RangeCoder: RangeCoder
    };
});
