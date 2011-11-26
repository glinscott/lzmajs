var assert = require('assert');
var RangeCoder = require('./rangeCoder');
var BitEncoder = require('./bitEncoder');
var LzmaDecompress = require('./lzma');

var compareArray = function(a1, a2) {
	var i;
	if (a1.length !== a2.length) {
		throw 'lengths not equal';
	}
	for (i = 0; i < a1.length; i++) {
		if (a1[i] !== a2[i]) {
			throw 'not equal at ' + i + ' a1[i]=' + a1[i] + ', a2[i]=' + a2[i];
		}
	}
};

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
	var i;
	var repeats = 3;
	var encoder = new RangeCoder.Encoder();
	for (i = 0; i < repeats; i++) {
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
	for (i = 0; i < repeats; i++) {
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
	// Simple test for the bit encoder
	var testSequence = [5, 1, 9, 8, 10, 15];
	var i;
	
	var bitEncoder = new BitEncoder.BitEncoder();
	var rangeEncoder = new RangeCoder.Encoder();
	bitEncoder.init();
	for (i = 0; i < testSequence.length; i++) {
		bitEncoder.encode(rangeEncoder, testSequence[i]);
	}
	rangeEncoder.finish();
	assert.deepEqual(rangeEncoder.bytes, [ 0, 249, 223, 15, 188 ]);
};

var testBitTreeEncoder = function(testSequence) {
	// Test the BitTreeEncoder, using LZMA.js decompression for verification
	var i;

	var rangeEncoder = new RangeCoder.Encoder();
	var bitTreeEncoder = new BitEncoder.BitTreeEncoder(8);
	bitTreeEncoder.init();
	for (i = 0; i < testSequence.length; i++) {
		bitTreeEncoder.encode(rangeEncoder, testSequence[i]);
	}
	rangeEncoder.finish();

	var bitTreeDecoder = new LzmaDecompress.LZMA.BitTreeDecoder(8);
	bitTreeDecoder.init();
	var rangeDecoder = new LzmaDecompress.LZMA.RangeDecoder();
	rangeDecoder.setStream(createInStream(rangeEncoder.bytes));
	rangeDecoder.init();

	var result = [];
	for (i = 0; i < testSequence.length; i++) {
		result[result.length] = bitTreeDecoder.decode(rangeDecoder);
	}
	compareArray(result, testSequence);
};

var buildSequence = function(length, maxVal) {
	var sequence = [];
	var seed = 0xDEADBEEF;
	var i;
	for (i = 0; i < length; i++) {
		seed = (seed * 73) + 0x1234567;
		sequence[i] = seed % maxVal;
	}
	return sequence;
};

var runAllTests = function() {
	testRangeCoder();
	testBitEncoder();

	var testSequenceSmall = [5, 112, 90, 8, 10, 153, 255, 0, 1];
	var testSequenceLarge = buildSequence(1000, 255);
	
	testBitTreeEncoder(testSequenceSmall);
	testBitTreeEncoder(testSequenceLarge);
};

var start = new Date();

runAllTests();

console.log('Testing finished in', new Date() - start, 'ms');