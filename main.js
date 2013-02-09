if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./lib/binTree', './lib/bitEncoder', './lib/encoder', './lib/lzma', './lib/rangeCoder'], function(BinTree, BitEncoder, Encoder, LZMA, RangeCoder) {
'use strict';

    return {
        version: "0.9.0",
        BinTree: BinTree,
        BitEncoder: BitEncoder,
        Encoder: Encoder,
        LZMA: LZMA,
        RangeCoder: RangeCoder
    };
});
