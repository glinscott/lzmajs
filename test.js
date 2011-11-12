var assert = require('assert');
var RangeCoder = require('./rangeCoder');

var simpleModel = function() {
	this.freq = [];
	this.visit = function(c) {
		this.freq[c]++;
	};
//	this.
};

var testRangeCoder = function() {
	var repeats = 100000;
//	var repeats = 3;
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

// 300ms
var start = new Date();
testRangeCoder();
console.log(new Date() - start);