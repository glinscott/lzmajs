if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./lib/bitEncoder', './lib/encoder', './lib/lzma', './lib/rangeCoder'], function(BitEncoder, Encoder, LZMA, RangeCoder) {
'use strict';

    return {
        version: "0.9.0",
        BitEncoder: BitEncoder,
        Encoder: Encoder,
        LZMA: LZMA,
        RangeCoder: RangeCoder
    };
});
