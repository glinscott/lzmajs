var kTopValue = 1 << 24, kBotValue = 1 << 16;

function shiftLeft8(v) {
	v <<= 8;
	return v >= 0 ? v : v + 0x100000000;
}

function Encoder() {
	var low = 0, range = 0xFFFFFFFF;
	var cacheSize = 1, cache = 0;
	this.bytes = [];

	this.encode = function(start, size, total) {
		range = (range / total) | 0;
		low += start * range;
		range *= size;
		while (range < kTopValue) {
			range = shiftLeft8(range);
			this.shiftLow();
		}
	};

	this.shiftLow = function() {
		var overflow = low > 0xFFFFFFFF;
		if (low < 0xFF000000 || overflow) {
			var temp = cache;
			do {
				this.bytes[this.bytes.length] = (temp + (overflow ? 1 : 0)) & 0xFF;
				temp = 0xFF;
			} while (--cacheSize !== 0);
			cache = low >>> 24;
		}
		cacheSize++;
		low = shiftLeft8(low);
	};
	
	this.finish = function() {
		var i;
		for (i = 0; i < 5; i++) {
			this.shiftLow();
		}
	};

	this.encodeBit = function(size, numTotalBits, symbol) {
		var newBound = (range >>> numTotalBits) * size;
		if (symbol === 0) {
			range = newBound;
		} else {
			low += newBound;
			range -= newBound;
		}
		while (range < kTopValue) {
			range = shiftLeft8(range);
			this.shiftLow();
		}
	};

/*	
	this.encodeDirectBits(v, numTotalBits) {
		for (var i = numTotalBits - 1; i != 0; i--) {
			range >>= 1;
			if (((v >> i) & 1) == 1)
				low += range;
			if (range < kTopValue) {
				range <<= 8;
				this.shiftLow();
			}
		}
	};
*/	
}

function Decoder(bytes) {
	var code = 0, range = 0xFFFFFFFF;
	var at = 0;
	var i;
	this.bytes = bytes;
	
	for (i = 0; i < 5; i++) {
		code = (code << 8) | this.bytes[at++];
	}

	this.normalize = function() {
		while (range < kTopValue) {
			code = shiftLeft8(code) | this.bytes[at++];
			range = shiftLeft8(range);
		}
	};

	this.getThreshold = function(total) {
		range = (range / total) | 0;
		return (code / range) | 0;
	};

	this.decode = function(start, size, total) {
		code -= start * range;
		range *= size;
		this.normalize();
	};
}

exports.Encoder = Encoder;
exports.Decoder = Decoder;