var RangeCoder = require('./rangeCoder');
var BitEncoder = require('./bitEncoder');
var BinTree = require('./binTree');

function Encoder() {
	var kInfinityPrice = 0xFFFFFFF;
	var kNumRepDistances = 4;
	var kNumStates = 12;
	var kDefaultDictionaryLogSize = 22;
	var kNumFastBytesDefault = 0x20;
	
	var kNumAlignBits = 4;
	var kAlignTableSize = 1 << kNumAlignBits;
	var kAlignMax = kAlignTableSize - 1;

	var kStartPosModelIndex = 4;
	var kEndPosModelIndex = 14;
	var kNumPosModels = kEndPosModelIndex - kStartPosModelIndex;

	var kNumFullDistances = 1 << (kEndPosModelIndex / 2);

	var kNumLowLenBits = 3;
	var kNumMidLenBits = 3;
	var kNumHighLenBits = 8;
	var kNumLowLenSymbols = 1 << kNumLowLenBits;
	var kNumMidLenSymbols = 1 << kNumMidLenBits;
	var kNumLenSymbols = kNumLowLenSymbols + kNumMidLenSymbols + (1 << kNumHighLenBits);
	var kMatchMinLen = 2;
	var kMatchMaxLen = kMatchMinLen + kNumLenSymbols - 1;
	
	var kNumPosSlotBits = 6;
	var kDicLogSizeMin = 0;
	
	var kNumLenToPosStatesBits = 2;
	var kNumLenToPosStates = 1 << kNumLenToPosStatesBits;
	
	var kNumPosStatesBitsMax = 4;
	var kNumPosStatesMax = 1 << kNumPosStatesBitsMax;
	var kNumPosStatesBitsEncodingMax = 4;
	var kNumPosStatesEncodingMax = 1 << kNumPosStatesBitsEncodingMax;
	var kNumOpts = 1 << 12;

	this.State = function() {
		this.init = function() {
			this.index = 0;
		};
		this.updateChar = function() {
			if (this.index < 4) {
				this.index = 0;
			} else if (this.index < 10) {
				this.index -= 3;
			} else {
				this.index -= 6;
			}
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
		var kFastSlots = 22, c = 2, slotFast;
		this.fastPos[0] = 0;
		this.fastPos[1] = 1;
		for (slotFast = 2; slotFast < kFastSlots; slotFast++) {
			var j, k = 1 << ((slotFast >> 1) - 1);
			for (j = 0; j < k; j++,c++) {
				this.fastPos[c] = slotFast;
			}
		}
	};
	
	this.getPosSlot = function(pos) {
		if (pos < (1 << 11)) {
			return this.fastPos[pos];
		}
		if (pos < (1 << 21)) {
			return this.fastPos[pos >>> 10] + 20;
		}
		return this.fastPos[pos >>> 20] + 40;
	};
	
	this.getPosSlot2 = function(pos) {
		if (pos < (1 << 17)) {
			return this.fastPos[pos >>> 6] + 12;
		}
		if (pos < (1 << 27)) {
			return this.fastPos[pos >>> 16] + 32;
		}
		return this.fastPos[pos >>> 26] + 52;
	};
	
	var state = new this.State();
	var previousByte;
	var repDistances = [];
	
	var baseInit = function() {
		var i;
		state.init();
		previousByte = 0;
		for (i = 0; i < kNumRepDistances; i++) {
			repDistances[i] = 0;
		}
	};
	
	this.LiteralEncoder = function() {
		this.Encoder2 = function() {
			var encoders = [];
			
			this.create = function() {
				var i;
				encoders = [];
				for (i = 0; i < 0x300; i++) {
					encoders[i] = new BitEncoder.BitEncoder();
				}
			};
			
			this.init = function() {
				var i;
				for (i = 0; i < 0x300; i++) {
					encoders[i].init();
				}
			};
			
			this.encode = function(rangeEncoder, symbol) {
				var context = 1, i;
				for (i = 7; i >= 0; i--) {
					var bit = (symbol >>> i) & 1;
					encoders[context].Encode(rangeEncoder, bit);
					context = (context << 1) | bit;
				}
			};
			
			this.encodeMatched = function(rangeEncoder, matchByte, symbol) {
				var context = 1, same = true, i;
				for (i = 7; i>= 0; i--) {
					var bit = (symbol >> i) & 1;
					var state = context;
					if (same) {
						var matchBit = (matchByte >>> i) & 1;
						state += (1 + matchBit) << 8;
						same = (matchBit === bit);
					}
					encoders[state].Encode(rangeEncoder, bit);
					context = (context << 1) | bit;
				}
			};
			
			this.getPrice = function(matchMode, matchByte, symbol) {
				var price = 0;
				var context = 1;
				var i = 7;
				var bit, matchBit;
				if (matchMode) {
					for (; i >= 0; i--) {
						matchBit = (matchByte >>> i) & 1;
						bit = (symbol >>> i) & 1;
						price += encoders[((1 + matchBit) << 8) + context].GetPrice(bit);
						context = (context << 1) | bit;
						if (matchBit !== bit) {
							i--;
							break;
						}
					}
				}
				for (; i >= 0; i--) {
					bit = (symbol >>> i) & 1;
					price += encoders[context].GetPrice(bit);
					context = (context << 1) | bit;
				}
				return price;
			};
		};
		
		var coders = [];
		var _numPrevBits = -1, _numPosBits = -1, posMask;
		
		this.create = function(numPosBits, numPrevBits) {
			var i;
			if (_numPrevBits === numPrevBits & _numPosBits === numPosBits) {
				return;
			}
				
			_numPosBits = numPosBits;
			_posMask = (1 << numPosBits) - 1;
			_numPrevBits = numPrevBits;
			var numStates = 1 << (_numPrevBits + _numPosBits);
			for (i = 0; i < numStates; i++) {
				coders[i] = new this.Encoder2();
				coders[i].create();
			}
		};
		
		this.init = function() {
			var numStates = 1 << (_numPrevBits + _numPosBits), i;
			for (i = 0; i < numStates; i++) {
				coders[i].init();
			}
		};

		this.getSubCoder = function(pos, prevByte) {
			return coders[((pos & posMask) << _numPrevBits) + (prevByte >> (8 - _numPrevBits))];
		};
	};
	
	this.LenEncoder = function() {
		var choice = new BitEncoder.BitEncoder();
		var choice2 = new BitEncoder.BitEncoder();
		var lowCoder = [], midCoder = [];
		var highCoder = new BitEncoder.BitTreeEncoder(kNumHighLenBits);
		var posState;
		
		for (posState = 0; posState < kNumPosStatesEncodingMax; posState++) {
			lowCoder[posState] = new BitEncoder.BitTreeEncoder(kNumLowLenBits);
			midCoder[posState] = new BitEncoder.BitTreeEncoder(kNumMidLenBits);
		}
		
		this.init = function(numPosStates) {
			choice.init();
			choice2.init();
			for (posState = 0; posState < numPosStates; posState++) {
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
				if (i >= numSymbols) {
					return;
				}
				prices[st + i] = a0 + lowCoder[posState].getPrice(i);
			}
			for (; i < kNumLowLenSymbols + kNumMidLenSymbols; i++) {
				if (i >= numSymbols) {
					return;
				}
				prices[st + i] = b0 + midCoder[posState].getPrice(i - kNumLowLenSymbols);
			}
			for (; i < numSymbols; i++) {
				prices[st + i] = b1 + highCoder.getPrice(i - kNumLowLenSymbols - kNumMidLenSymbols);
			}
		};
	};
	
	var kNumLenSpecSymbols = kNumLowLenSymbols + kNumMidLenSymbols;
	
	// Derives from LenEncoder
	this.LenPriceTableEncoder = function() {
		var prices = [];
		var counters = [];
		var tableSize;
		
		this.setTableSize = function(tableSize_) {
			tableSize = tableSize_;
		};
		
		this.updateTable = function(posState) {
			this.setPrices(posState, tableSize, prices, posState * kNumLenSymbols);
			counters[posState] = tableSize;
		};
		
		this.updateTables = function(numPosStates) {
			var posState;
			for (posState = 0; posState < numPosStates; posState++) {
				this.updateTable(posState);
			}
		};
		
		this.encode = function(rangeEncoder, symbol, posState) {
			this.prototype.encode(rangeEncoder, symbol, posState);
			if (--counters[posState] === 0) {
				this.updateTable(posState);
			}
		};
	};

	this.LenPriceTableEncoder.prototype = new this.LenEncoder();
	
	this.Optimal = function() {
	};
	
	var _optimum = [];
	var _matchFinder = null;
	var _rangeEncoder = new RangeCoder.Encoder();

	var _isMatch = [], _isRep = [], _isRepG0 = [], _isRepG1 = [];
	var _isRepG2 = [], _isRep0Long = [], _posSlotEncoder = [];
	var _posEncoders = [];
	var _posAlignEncoder = new BitEncoder.BitTreeEncoder(kNumAlignBits);
	
	var _lenEncoder = new this.LenPriceTableEncoder();
	var _repMatchLenEncoder = new this.LenPriceTableEncoder();
	
	var _literalEncoder = new this.LiteralEncoder();
	
	var _matchDistances = [];
	var _numFastBytes = kNumFastBytesDefault;
	var _longestMatchLength, _numDistancePairs;
	var _additionalOffset, _optimumEndIndex, _optimumCurrentIndex, _longestMatchWasFound;
	
	var _posSlotPrices = [], _distancePrices = [], _alignPrices = [];
	var _alignPriceCount;
	
	var _distTableSize = kDefaultDictionaryLogSize * 2;
	
	var _posStateBits = 2;
	var _posStateMask = 4 - 1;
	var _numLiteralPosStateBits = 0;
	var _numLiteralContextBits = 3;
	
	var _dictionarySize = 1 << kDefaultDictionaryLogSize;
	var _dictionarySizePrev = 0xFFFFFFFF;
	var _numFastBytesPrev = 0xFFFFFFFF;
	
	var nowPos64, finished, _inStream;
	var _matchFinderType = 'BT4', _writeEndMark = false;
	var _needReleaseMFStream;
	
	this.create = function() {
		var numHashBytes;
		if (_matchFinder === null) {
			numHashBytes = this._matchFinderType === 'BT2' ? 2 : 4;
			_matchFinder = new BinTree.BinTree();
			_matchFinder.setType(numHashBytes);
		}
		
		_literalEncoder.create(this._numLiteralPosStateBits, this._numLiteralContextBits);
		
		if (_dictionarySize === _dictionarySizePrev && _numFastBytesPrev === _numFastBytes) {
			return;
		}
		_matchFinder.create(_dictionarySize, kNumOpts, _numFastBytes, kMatchMaxLen + 1);
		_dictionarySizePrev = _dictionarySize;
		_numFastBytesPrev = _numFastBytes;
	};
	
	this.setWriteEndMarkerMode = function(writeEndMarker) {
		_writeEndMark = writeEndMarker;
	};

	this.init = function() {
		// From ctor
		var i, j, complexState;
		for (i = 0; i < kNumOpts; i++) {
			_optimum[i] = new this.Optimal();
		}
		for (i = 0; i < kNumLenToPosStates; i++) {
			_posSlotEncoder[i] = new BitEncoder.BitTreeEncoder(kNumPosSlotBits);
		}
		
		// Normal init
		baseInit();
		_rangeEncoder.init();
		
		for (i = 0; i < kNumStates; i++) {
			for (j = 0; j <= _posStateMask; j++) {
				complexState = (i << kNumPosStatesBitsMax) + j;
				_isMatch[complexState] = new BitEncoder.BitEncoder();
				_isMatch[complexState].init();
				_isRep0Long[complexState] = new BitEncoder.BitEncoder();
				_isRep0Long[complexState].init();
			}
			_isRep[i] = new BitEncoder.BitEncoder();
			_isRep[i].init();
			_isRepG0[i] = new BitEncoder.BitEncoder();
			_isRepG0[i].init();
			_isRepG1[i] = new BitEncoder.BitEncoder();
			_isRepG1[i].init();
			_isRepG2[i] = new BitEncoder.BitEncoder();
			_isRepG2[i].init();
		}
		
		_literalEncoder.init();
		for (i = 0; i < kNumLenToPosStates; i++) {
			_posSlotEncoder[i].init();
		}
		for (i = 0; i < kNumFullDistances - kEndPosModelIndex; i++) {
			_posEncoders[i] = new BitEncoder.BitEncoder();
			_posEncoders[i].init();
		}
		
		_lenEncoder.init(1 << _posStateBits);
		_repMatchLenEncoder.init(1 << _posStateBits);
		
		_posAlignEncoder.init();
		
		_longestMatchWasFound = false;
		_optimumEndIndex = 0;
		_optimumCurrentIndex = 0;
		_additionalOffset = 0;
	};
	
	this.readMatchDistances = function() {
		var lenRes = 0;
		var numDistancePairs = _matchFinder.getMatches(_matchDistances);
		if (numDistancePairs > 0) {
			lenRes = _matchDistances[numDistancePairs - 2];
			if (lenRes === _numFastBytes) {
				lenRes += _matchFinder.getMatchLen(lenRes - 1, _matchDistances[numDistancePairs - 1], kMatchMaxLen - lenRes);
			}
		}
		_additionalOffset++;
		return {
			lenRes: lenRes,
			numDistancePairs: numDistancePairs
		};
	};
	
	this.movePos = function(num) {
		if (num > 0) {
			_matchFinder.skip(num);
			_additionalOffset += num;
		}
	};
	
	this.getRepLen1Price = function(state, posState) {
		return _isRepG0[state.index].getPrice0() +
			_isRep0Long[(state.index << kNumPosStatesBitsMax) + posState].getPrice0();
	};

	this.code = function() {
		var progressPosValuePrev = nowPos;
		if (nowPos === 0) {
			if (matchFinder.getNumAvailableBytes() === 0) {
				this.flush(nowPos);
				return;
			}
			
			var result = this.readMatchDistances();
			var posState = nowPos & posStateMask;
			
		}
	};
}

exports.Encoder = Encoder;