var assert = require('assert');
var RangeCoder = require('./rangeCoder');
var BitEncoder = require('./bitEncoder');
var LzmaDecompress = require('./lzma');

var createInStream = function(data) {
	var inStream = {
	  data: data,
	  offset: 0,
	  readByte: function(){
	    return this.data[this.offset++];
	  }
	};
	return inStream;
};

var testRangeCoder = function() {
//	var repeats = 100000;
	var repeats = 3;
	var encoder = new RangeCoder.Encoder();
	for (var i = 0; i < repeats; i++) {
		encoder.encode(0,6,20);
		encoder.encode(0,6,20);
		encoder.encode(6,2,20);
		encoder.encode(0,6,20);
	}
	encoder.encode(8,2,20);
	encoder.finish();
	
	var decoder = new RangeCoder.Decoder(encoder.bytes);
	var inside = function(l, r, v) {
		assert.ok(v >= l && v < r, v + ' not in ' + l + ',' + r);
	};
	for (var i = 0; i < repeats; i++) {
		inside(0, 6, decoder.getThreshold(20));
		decoder.decode(0,6,20);
		inside(0, 6, decoder.getThreshold(20));
		decoder.decode(0,6,20);
		inside(6, 8, decoder.getThreshold(20));
		decoder.decode(6,2,20);
		inside(0, 6, decoder.getThreshold(20));
		decoder.decode(0,6,20);
	}
	inside(8, 10, decoder.getThreshold(20));
};

var testBitEncoder = function() {
	var testSequence = [5, 1, 9, 8, 10, 15];
	
	var bitEncoder = new BitEncoder.BitEncoder();
	var rangeEncoder = new RangeCoder.Encoder();
	bitEncoder.init();
	for (var i = 0; i < testSequence.length; i++) {
		bitEncoder.encode(rangeEncoder, testSequence[i]);
	}
	rangeEncoder.finish();
	assert.deepEqual(rangeEncoder.bytes, [ 0, 249, 223, 15, 188 ]);

	rangeEncoder = new RangeCoder.Encoder();
	var bitTreeEncoder = new BitEncoder.BitTreeEncoder(5);
	bitTreeEncoder.init();
	for (var i = 0; i < testSequence.length; i++) {
		bitTreeEncoder.encode(rangeEncoder, testSequence[i]);
	}
	rangeEncoder.finish();

	var bitTreeDecoder = new LzmaDecompress.LZMA.BitTreeDecoder(5);
	bitTreeDecoder.init();
	var rangeDecoder = new LzmaDecompress.LZMA.RangeDecoder();
	rangeDecoder.setStream(createInStream(rangeEncoder.bytes));
	rangeDecoder.init();

	var result = [];
	for (var i = 0; i < testSequence.length; i++) {
		result[result.length] = bitTreeDecoder.decode(rangeDecoder);
	}
	assert.deepEqual(result, testSequence);
};

var start = new Date();
testRangeCoder();
testBitEncoder();
console.log(new Date() - start);