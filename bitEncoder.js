function BitEncoder() {
	var kNumBitModelTotalBits = 11;
	var kBitModelTotal = 1 << kNumBitModelTotalBits;
	var kNumMoveBits = 5;
	var kNumMoveReducingBits = 2;
	var kNumBitPriceShiftBits = 6;
	
	var prob;
	var probPrices = [];
	
	this.init = function() {
		prob = kBitModelTotal >> 1;
	};
	
	this.updateModel = function(symbol) {
		if (symbol == 0)
			prob += (kBitModelTotal - prob) >>> kNumMoveBits;
		else
			prob -= prob >>> kNumMoveBits;
	};
	
	this.encode = function(encoder, symbol) {
		encoder.encodeBit(prob, kNumBitModelTotalBits, symbol);
		this.updateModel(symbol);
	};
	
	this.getPrice = function(symbol) {
		var priceIndex = ((prob - symbol) ^ (-symbol)) & (kBitModelTotal - 1);
		return this.probPrices[priceIndex >>> kNumMoveReducingBits];
	};
	
	var initializeProbPrices = function() {
		var kNumBits = kNumBitModelTotalBits - kNumMoveReducingBits;
		for (var i = kNumBits - 1; i >= 0; i--) {
			var start = 1 << (kNumBits - i - 1);
			var end = 1 << (kNumBits - i);
			for (var j = start; j < end; j++)
				probPrices[j] = (i << kNumBitPriceShiftBits) +
					(((end - j) << kNumBitPriceShiftBits) >>> (kNumBits - i - 1));
		}
	};
	
	// TODO: make this statically initialized
	if (probPrices.length == 0)
		initializeProbPrices();
};

function BitTreeEncoder(numBitLevels) {
	this.models = [];

	this.init = function() {
		for (var i = 1; i < (1 << numBitLevels); i++) {
			this.models[i] = new BitEncoder();
			this.models[i].init();
		}
	};

	this.encode = function(rangeEncoder, symbol) {
		var m = 1;
		for (var bitIndex = numBitLevels - 1; bitIndex >= 0; bitIndex--) {
			var bit = (symbol >>> bitIndex) & 1;
			this.models[m].encode(rangeEncoder, bit);
			m = (m << 1) | bit;
		}
	};
	
	this.reverseEncode = function(rangeEncoder, symbol) {
		var m = 1;
		for (var i = 0; i < numBitLevels; i++) {
			var bit = symbol & 1;
			this.models[m].encode(rangeEncoder, bit);
			m = (m << 1) | bit;
			symbol >>>= 1;
		}
	};
	
	this.getPrice = function(symbol) {
		var price = 0, m = 1;
		for (var i = numBitLevels; i > 0; i--) {
			var bit = symbol & 1;
			symbol >>>= 1;
			price += this.models[m].getPrice(bit);
			m = (m << 1) | bit;
		}
		return price;
	};
};

exports.BitTreeEncoder = BitTreeEncoder;
exports.BitEncoder = BitEncoder;