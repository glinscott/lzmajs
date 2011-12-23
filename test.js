var assert = require('assert');
var RangeCoder = require('./rangeCoder');
var BitEncoder = require('./bitEncoder');
var Encoder = require('./encoder');
var LzmaDecompress = require('./lzma');
var BinTree = require('./binTree');

var min = function(a, b) {
	return a < b ? a : b;
};

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

var createEncoderStream = function(data) {
	var stream = {
		data: data,
		offset: 0,
		read: function(buffer, bufOffset, length) {
			var bytesRead = 0;
			while (bytesRead < length && this.offset < data.length) {
				buffer[bufOffset++] = this.data[this.offset++];
				bytesRead++;
			}
			return bytesRead;
		}
	};
	return stream;
}

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

var testCRC = function() {
	assert.equal(BinTree.CRC.table.length, 256);
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
		seed = ((seed * 73) + 0x1234567) % 0xFFFFFFFF;
		sequence[i] = seed % maxVal;
	}
	return sequence;
};

var testEncoder = function() {
	var rangeEncoder = new RangeCoder.Encoder();
	var encoder = new Encoder.Encoder();
	encoder.create();
	encoder.init();
	
	var literalEncoder = new encoder.LiteralEncoder();
	literalEncoder.create(2, 3);
	literalEncoder.init();
	var subCoder = literalEncoder.getSubCoder(5, 11);
	assert.ok(subCoder !== null);
	
	var lenEncoder = new encoder.LenEncoder();
	lenEncoder.init(5);
	lenEncoder.encode(rangeEncoder, 1, 0);
	lenEncoder.encode(rangeEncoder, 20, 0);
	lenEncoder.encode(rangeEncoder, 199, 0);
	rangeEncoder.finish();
	
	var lenPriceTableEncoder = new encoder.LenPriceTableEncoder();
	lenPriceTableEncoder.init();
};

var testBinTree = function(sequence) {
	var stream = createEncoderStream(sequence);
	
	var blockSize = (1 << 12) + 0x20 + 275;
	var inWindow = new BinTree.InWindow();
	inWindow.createBase(1 << 12, 0x20, 275);
	inWindow.setStream(stream);
	inWindow.initBase();
	
	// Test basics
	var remaining = min(sequence.length, blockSize);
	assert.equal(inWindow.getNumAvailableBytes(), remaining);
	assert.equal(inWindow.getIndexByte(0), sequence[0]);
	assert.equal(inWindow.getIndexByte(1), sequence[1]);
	inWindow.movePosBase();
	assert.equal(inWindow.getNumAvailableBytes(), remaining - 1);
	assert.equal(inWindow.getIndexByte(0), sequence[1]);

	// Test sequence matching
	var testSequenceRepeats = [0, 1, 2, 3, 5, 0, 1, 2, 3, 4];
	inWindow.setStream(createEncoderStream(testSequenceRepeats));
	inWindow.initBase();
	assert.equal(inWindow.getMatch(5, 4, 8), 4);
	
	// Test BinTree
	stream = createEncoderStream(sequence);
	var binTree = new BinTree.BinTree();
	binTree.setType(4);
	binTree.create(1 << 22, 1 << 12, 0x20, 275);
	binTree.setStream(stream);
	binTree.init();

	assert.equal(binTree.getNumAvailableBytes(), sequence.length);
};

var runAllTests = function() {
	testRangeCoder();
	testBitEncoder();
	testCRC();

	var testSequenceSmall = [5, 112, 90, 8, 10, 153, 255, 0, 0, 15];
	var testSequenceLarge = buildSequence(10000, 255);

	testBitTreeEncoder(testSequenceSmall);
	testBitTreeEncoder(testSequenceLarge);
	
	testBinTree(testSequenceSmall);
	testBinTree(testSequenceLarge);
	
	testEncoder();
};

var start = new Date();

runAllTests();

console.log('Testing finished in', new Date() - start, 'ms');