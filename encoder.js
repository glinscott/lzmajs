function Encoder() {
	var kInfinityPrice = 0xFFFFFFF;
	var kNumRepDistances = 4;
	var kNumStates = 12;
	var kDefaultDictionaryLogSize = 22;
	var kNumFastBytesDefault = 0x20;
	
	var kNumLowLenBits = 3;
	var kNumMidLenBits = 3;
	var kNumHighLenBits = 8;
	var kNumLowLenSymbols = 1 << kNumLowLenBits;
	var kNumMidLenSymbols = 1 << kNumMidLenBits;
	var kNumLenSymbols = kNumLowLenSymbols + kNumMidLenSymbols + (1 << kNumHighLenBits);
	var kMatchMaxLen = kMatchMinLen + kNumLenSymbols - 1;

	this.State = function() {
		this.init = function() {
			this.index = 0;
		};
		this.updateChar = function() {
			if (this.index < 4) this.index = 0;
			else if (this.index < 10) this.index -= 3;
			else this.index -= 6;
		};
		this.updateMatch = function() {
			this.index = this.index < 7 ? 7 : 10;
		};
		this.updateRep = function() {
			this.index = this.index < 7 ? 8 : 11;
		};
		this.updateShortRep = function() {
			this.index = this.index < 7 ? 9 : 11;
		};
		this.isCharState = function() {
			return this.index < 7;
		};
	};
	
	this.fastPos = [];

	this.init = function() {
		var fastSlots = 22;
		var c = 2;
		this.fastPos[0] = 0;
		this.fastPos[1] = 1;
		for (var slotFast = 2; slotFast < kFastSlots; slotFast++) {
			var k = 1 << ((slotFast >> 1) - 1);
			for (var j = 0; j < k; j++,c++)
				this.fastPos[c] = slotFast;
		}
	};
	
	this.getPosSlot = function(pos) {
		if (pos < (1 << 11))
			return this.fastPos[pos];
		if (pos < (1 << 21))
			return this.fastPos[pos >>> 10] + 20;
		return this.fastPos[pos >>> 20] + 40;
	};
	
	this.getPosSlot2 = function(pos) {
		if (pos < (1 << 17))
			return this.fastPos[pos >>> 6] + 12;
		if (pos < (1 << 27))
			return this.fastPos[pos >>> 16] + 32;
		return this.fastPos[pos >>> 26] + 52;
	};
	
	var state = new this.state;
	var previousByte;
	var repDistances = [];
	
	var baseInit = function() {
		state.init();
		previousByte = 0;
		for (var i = 0; i < kNumRepDistances; i++)
			repDistances[i] = 0;
	};
	
	this.LiteralEncoder = function() {
		this.Encoder2 = function() {
			var encoders;
			
			this.create = function() {
				encoders = [];
				for (var i = 0; i < 0x300; i++)
					encoders[i] = new BitEncoder();
			};
			
			this.init = function() {
				for (var i = 0; i < 0x300; i++)
					encoders[i].Init();
			};
			
			this.encode = function(rangeEncoder, symbol) {
				var context = 1;
				for (var i = 7; i >= 0; i--) {
					var bit = (symbol >>> i) & 1;
					encoders[context].Encode(rangeEncoder, bit);
					context = (context << 1) | bit;
				}
			};
			
			this.encodeMatched = function(rangeEncoder, matchByte, symbol) {
				var context = 1;
				var same = true;
				for (var i = 7; i>= 0; i--) {
					var bit = (symbol >> i) & 1;
					var state = context;
					if (same) {
						var matchBit = (matchByte >>> i) & 1;
						state += (1 + matchBit) << 8;
						same = (matchBit == bit);
					}
					encoders[state].Encode(rangeEncoder, bit);
					context = (context << 1) | bit;
				}
			};
			
			this.getPrice = function(matchMode, matchByte, symbol) {
				var price = 0;
				var context = 1;
				var i = 7;
				if (matchMode) {
					for (; i >= 0; i--) {
						var matchBit = (matchByte >>> i) & 1;
						var bit = (symbol >>> i) & 1;
						price += encoders[((1 + matchBit) << 8) + context].GetPrice(bit);
						context = (context << 1) | bit;
						if (matchBit != bit) {
							i--;
							break;
						}
					}
				}
				for (; i >= 0; i--) {
					var bit = (symbol >>> i) & 1;
					price += encoders[context].GetPrice(bit);
					context = (context << 1) | bit;
				}
				return price;
			};
		};
		
		var coders = [];
		var _numPrevBits = -1, _numPosBits = -1, posMask;
		
		this.create = function(numPosBits, numPrevBits) {
			if (_numPrevBits == numPrevBits & _numPosBits == numPosBits)
				return;
				
			_numPosBits = numPosBits;
			_posMask = (1 << numPosBits) - 1;
			_numPrevBits = numPrevBits;
			var numStates = 1 << (_numPrevBits + _numPosBits);
			for (var i = 0; i < numStates; i++) {
				coders[i] = new Encoder2();
				coders[i].create();
			}
		};
		
		this.init = function() {
			var numStates = 1 << (_numPrevBits + _numPosBits);
			for (var i = 0; i < numStates; i++)
				coders[i].init();
		};
		
		this.getSubCoder = function(pos, prevByte) {
			return coders[((pos & posMask) << _numPrevBits) + (prevByte >> (8 - _numPrevBits))];
		};
	};
	
	this.LenEncoder = function() {
		var choice = new BitEncoder();
		var choice2 = new BitEncoder();
		var lowCoder = [], midCoder = [];
		var highCoder = new BitTreeEncoder(kNumHighLenBits);
		
		for (var posState = 0; posState < kumPosStatesEncodingMax; posState++) {
			lowCoder[posState] = new BitTreeEncoder(kNumLowLenBits);
			midCoder[posState] = new BitTreeEncoder(kNumMidLenBits);
		}
		
		this.init = function(numPosStates) {
			choice.Init();
			choice2.Init();
			for (var posState = 0; posState < numPosStates; posState++) {
				lowCoder[posState].init();
				midCoder[posState].init();
			}
			highCoder.init();
		};
		
		this.encode = function(rangeEncoder, symbol, posState) {
			if (symbol < kNumLowLenSymbols) {
				choice.encode(rangeEncoder, 0);
				lowCoder[posState].encode(rangeEncoder, symbol);
			} else {
				symbol -= kNumLowLenSymbols;
				choice.encode(rangeEncoder, 1);
				if (symbol < kNumMidLenSymbols) {
					choice2.encode(rangeEncoder, 0);
					midCoder[posState].encode(rangeEncoder, symbol);
				} else {
					choice2.encode(rangeEncoder, 1);
					highCoder.encode(rangeEncoder, symbol - kNumMidLenSymbols);
				}
			}
		};
		
		this.setPrices = function(posState, numSymbols, prices, st) {
			var a0 = choice.getPrice0();
			var a1 = choice.getPrice1();
			var b0 = a1 + choice2.getPrice0();
			var b1 = a1 + choice2.getPrice1();
			var i;
			for (i = 0; i < kNumLowLenSymbols; i++) {
				if (i >= numSymbols)
					return;
				prices[st + i] = a0 + lowCoder[posState].getPrice(i);
			}
			for (; i < kNumLowLenSymbols + kNumMidLenSymbols; i++) {
				if (i >= numSymbols)
					return;
				prices[st + i] = b0 + midCoder[posState].getPrice(i - kNumLowLenSymbols);
			}
			for (; i < numSymbols; i++)
				prices[st + i] = b1 + highCoder.getPrice(i - kNumLowLenSymbols - kNumMidLenSymbols);
		};
	};
	
	var kNumLenSpecSymbols = kNumLowLenSymbols + kNumMidLenSymbols;
	
	this.LenPriceTableEncoder = function() {
		
	}
	
	this.code = function() {
		var progressPosValuePrev = nowPos;
		if (nowPos == 0) {
			if (matchFinder.getNumAvailableBytes() == 0) {
				this.flush(nowPos);
				return;
			}
			
			var result = this.readMatchDistances();
			var posState = nowPos & posStateMask;
			
		}
	};
};