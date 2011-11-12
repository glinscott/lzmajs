var kTopValue = 1 << 24, kBotValue = 1 << 16;

function Encoder() {
	var low = 0, range = 0xFFFFFFFF;	
	this.bytes = [];

	this.encode = function(start, size, total) {
		range = Math.floor(range / total);
		low += start * range;
		range *= size;
		for(;;) {
			var comp = (low ^ (low + range));
			if (comp < 0 || comp >= kTopValue) break;

			this.bytes[this.bytes.length] = low >>> 24;
			range <<= 8;
			if (range < 0) range += 0x80000000;
			low <<= 8;
		}
		for(;;) {
			if (range < 0 || range >= kBotValue) break;
			this.bytes[this.bytes.length] = low >>> 24;
			range = ((-low) & 0xFFFF) << 8;
			if (range < 0) range += 0x80000000;
			low <<= 8;
		}
	};
	
	this.finish = function() {
		for (var i = 0; i < 4; i++) {
			this.bytes[this.bytes.length] = low >>> 24;
			low <<= 8;
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
	
	this.encodeBit = function(size, numTotalBits, symbol) {
		var newBound = (range >> numTotalBits) * size;
		if (symbol == 0)
			range = newBound;
		else {
			low += newBound;
			range -= newBound;
		}
		while (range < kTopValue) {
			range <<= 8;
			this.shiftLow();
		}
	};*/
};

function Decoder(bytes) {
	var code = 0, low = 0, range = 0xFFFFFFFF;
	var at = 0;
	this.bytes = bytes;
	
	for (var i = 0; i < 4; i++) {
		code = (code << 8) | this.bytes[at++];
	}
	if (code < 0) code += 0x80000000;

	this.getThreshold = function(total) {
		range = Math.floor(range / total);
		var cl = code - low;
		if (cl < 0) cl += 0x80000000;
		return Math.floor(cl / range);
	};

	this.decode = function(start, size, total) {
		low += start * range;
		range *= size;
		for(;;) {
			var comp = (low ^ (low + range));
			if (comp < 0 || comp >= kTopValue) break;

			code = (code << 8 ) | this.bytes[at++];
			if (code < 0) code += 0x80000000;
			range <<= 8;
			if (range < 0) range += 0x80000000;
			low <<= 8;
			if (low < 0) low += 0x80000000;
		}
		for(;;) {
			if (range < 0 || range >= kBotValue) break;
			code = (code << 8 ) | this.bytes[at++];
			range =  ((-low) & 0xFFFF) << 8;
			if (range < 0) range += 0x80000000;
			low <<= 8;
			if (low < 0) low += 0x80000000;
		}		
	};
};

exports.Encoder = Encoder;
exports.Decoder = Decoder;