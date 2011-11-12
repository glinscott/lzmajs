function BitEncoder() {
	var kNumBitModelTotalBits = 11;
	var kBitModelTotal = 1 << kNumBitModelTotalBits;
	var kNumMoveBits = 5;
	var kNumMoveReducingBits = 2;
	var kNumBitPriceShiftBits = 6;
	
	var prob;
	this.prototype.probPrices = [];
	
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
				this.probPrices[j] = (i << kNumBitPriceShiftBits) +
					(((end - j) << kNumBitPriceShiftBits) >>> (kNumBits - i - 1));
		}
	};
	
	if (this.probPrices.length == 0)
		initializeProbPrices();
};