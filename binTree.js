function CRCInit() {
	table = [];
	
	var kPoly = 0xEDB88320, i, j, r;
	for (i = 0; i < 256; i++) {
		r = i;
		for (j = 0; j < 8; j++) {
			if ((r & 1) !== 0) {
				r = (r >>> 1) ^ kPoly;
			} else {
				r >>>= 1;
			}
		}
		table[i] = r;
	}
	
	return table;
}

var CRC = function() { };
CRC.prototype.table = CRCInit();

function InWindow() {
	this.moveBlock = function() {
		var i;
		var offset = this._bufferOffset + this._pos + _keepSizeBefore;
		if (offset > 0) {
			offset--;
		}
			
		var numBytes = this._bufferOffset + this._streamPos - offset;
		for (i = 0; i < numBytes; i++) {
			this._bufferBase[i] = this._bufferBase[offset + i];
		}
		this._bufferOffset -= offset;
	};
	
	this.readBlock = function() {
		if (this._streamEndWasReached) {
			return;
		}
		for (;;) {
			var size = -this._bufferOffset + this._blockSize - this._streamPos;
			if (size === 0) {
				return;
			}
			var numReadBytes = this._stream.read(this._bufferBase, this._bufferOffset + this._streamPos, size);
			if (numReadBytes === 0) {
				this._posLimit = this._streamPos;
				var pointerToPosition = this._bufferOffset + this._posLimit;
				if (pointerToPosition > this._pointerToLastSafePosition) {
					this._posLimit = this._pointerToLastSafePosition - this._bufferOffset;
				}
				
				this._streamEndWasReached = true;
				return;
			}
			this._streamPos += numReadBytes;
			if (this._streamPos >= this._pos + this._keepSizeAfter) {
				this._posLimit = this._streamPos - this._keepSizeAfter;
			}
		}
	};
	
	this.free = function() {
		this._bufferBase = null;
	};

	this.createBase = function(keepSizeBefore, keepSizeAfter, keepSizeReserve) {
		this._keepSizeBefore = keepSizeBefore;
		this._keepSizeAfter = keepSizeAfter;
		var blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserve;
		if (this._bufferBase === null || this._blockSize !== blockSize) {
			this.free();
			this._blockSize = blockSize;
			this._bufferBase = [];
		}
		this._pointerToLastSafePosition = this._blockSize - keepSizeAfter;
	};
	
	this.setStream = function(stream) {
		this._stream = stream;
	};
	
	this.releaseStream = function() {
		this._stream = null;
	};
	
	this.initBase = function() {
		this._bufferOffset = 0;
		this._pos = 0;
		this._streamPos = 0;
		this._streamEndWasReached = false;
		this.readBlock();
	};
	
	this.movePosBase = function() {
		this._pos++;
		if (this._pos > this._posLimit) {
			var pointerToPosition = this._bufferOffset + this._pos;
			if (pointerToPosition > this._pointerToLastSafePosition) {
				this.moveBlock();
			}
			this.readBlock();
		}
	};
	
	this.getIndexByte = function(index) {
		return this._bufferBase[this._bufferOffset + this._pos + index];
	};
	
	this.getMatch = function(index, distance, limit) {
		var pby, i = 0;
		if (this._streamEndWasReached) {
			if (this._pos + index + limit > this._streamPos) {
				limit = this._streamPos - (this._pos + index);
			}
		}
		distance++;
		pby = this._bufferOffset + this._pos + index;
		while (i < limit && this._bufferBase[pby + i] === this._bufferBase[pby + i - distance]) {
			i++;
		}
		return i;
	};

	this.getNumAvailableBytes = function() {
		return this._streamPos - this._pos;
	};

	this.reduceOffsets = function(subValue) {
		this._bufferOffset += subValue;
		this._posLimit -= subValue;
		this._pos -= subValue;
		this._streamPos -= subValue;
	};
}

function BinTree() {
	InWindow.call(this);
	
	this._cyclicBufferSize = 0;
	
	this._son = [];
	this._hash = [];

	this._cutValue = 0xFF;
	this._hashSizeSum = 0;
	
	this.hashArray = true;
	
	var kHash2Size = 1 << 10, kHash3Size = 1 << 16, kBT2HashSize = 1 << 16;
	var kStartMaxLen = 1, kHash3Offset = kHash2Size, kEmptyHashValue = 0;
	var kMaxValForNormalize = 0x7FFFFFFF;
	
	var kNumHashDirectBytes = 0;
	var kMinMatchCheck = 4;
	var kFixHashSize = kHash2Size + kHash3Size;
	
	this.setType = function(numHashBytes) {
		this.hashArray = numHashBytes > 2;
		if (this.hashArray) {
			kNumHashDirectBytes = 0;
			kMinMatchCheck = 4;
			kFixHashSize = kHash2Size + kHash3Size;
		} else {
			kNumHashDirectBytes = 2;
			kMinMatchCheck = 2 + 1;
			kFixHashSize = 0;
		}
	};

	this.init = function() {
		var i;
		this.initBase();
		for (i = 0; i < this._hashSizeSum; i++) {
			this._hash[i] = kEmptyHashValue;
		}
		this._cyclicBufferPos = 0;
		this.reduceOffsets(-1);
	};
	
	this.movePos = function() {
		if (++_this.cyclicBufferPos >= this._cyclicBufferSize) {
			this._cyclicBufferPos = 0;
		}
		this.movePosBase();
		if (this._pos === kMaxValForNormalize) {
			this.normalize();
		}
	};
	
	this.create = function(historySize, keepAddBufferBefore, matchMaxLen, keepAddBufferAfter) {
		var windowReserveSize, cyclicBufferSize, hs;
		
		if (historySize > kMaxValForNormalize - 256) {
			throw 'Unsupported historySize';
		}
		this._cutValue = 16 + (matchMaxLen >>> 1);
		windowReserveSize = (historySize + keepAddBufferBefore + matchMaxLen + keepAddBufferAfter) / 2 + 256;
		
		this.createBase(historySize + keepAddBufferBefore, matchMaxLen + keepAddBufferAfter, windowReserveSize);
		
		this._matchMaxLen = matchMaxLen;
		
		cyclicBufferSize = historySize + 1;
		if (this._cyclicBufferSize !== cyclicBufferSize) {
			this._son = [];
		}
		
		hs = kBT2HashSize;
		
		if (this.hashArray) {
			hs = historySize - 1;
			hs |= hs >>> 1;
			hs |= hs >>> 2;
			hs |= hs >>> 4;
			hs |= hs >>> 8;
			hs >>>= 1;
			hs |= 0xFFFF;
			if (hs > (1 << 24)) {
				hs >>>= 1;
			}
			this._hashMask = hs;
			hs++;
			hs += kFixHashSize;
		}
		if (hs !== this._hashSizeSum) {
			this._hashSizeSum = hs;
			this._hash = new Array(this._hashSizeSum);
		}
	};
	
	this.getMatches = function(distances) {
		var lenLimit, offset, matchMinPos, cur, maxLen, hashValue, hash2Value, hash3Value;
		var temp, curMatch, curMatch2, curMatch3, ptr0, ptr1, len0, len1, count, delta;
		var cyclicPos, pby1, len;
		if (this._pos + this._matchMaxLen <= this._streamPos) {
			lenLimit = this._matchMaxLen;
		} else {
			lenLimit = this._streamPos - this._pos;
			if (lenLimit < kMinMatchCheck) {
				this.movePos();
				return 0;
			}
		}
		
		offset = 0;
		matchMinPos = (this._pos > this._cyclicBufferSize) ? (this._pos - this._cyclicBufferSize) : 0;
		cur = this._bufferOffset + this._pos;
		maxLen = kStartMaxLen; // to avoid items for len < hashSize
		hashValue = hash2Value = hash3Value = 0;
		
		if (this.hashArray) {
			temp = CRC.table[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
			hash2Value = temp & (kHash2Size - 1);
			temp ^= _bufferBase[cur + 2] << 8;
			hash3Value = temp & (kHash3Size - 1);
			hashValue = (temp ^ (CRC.table[this._bufferBase[cur + 1]] << 5)) & this._hashMask;
		} else {
			hashValue = this._bufferBase[cur] ^ (this._bufferBase[cur + 1] << 8);
		}
		
		curMatch = this._hash[kFixHashSize + hashValue];
		if (this.hashArray) {
			curMatch2 = this._hash[hash2Value];
			curMatch3 = this._hash[kHash3Offset + hash3Value];
			this._hash[hash2Value] = this._pos;
			this._hash[hash3OFfset + hash3Value] = this._pos;
			if (curMatch2 > matchMinPos) {
				if (this._bufferBase[this._bufferOffset + curMatch3] === this._bufferBase[cur]) {
					distances[offset++] = maxLen = 2;
					distances[offset++] = this._pos - curMatch2 - 1;
				}
			}
			if (curMatch3 > matchMinPos) {
				if (this._bufferBase[this._bufferOffset + curMatch3] === this._bufferBase[cur]) {
					if (curMatch3 === curMatch2) {
						offset -= 2;
					}
					distances[offset++] = maxLen = 3;
					distances[offset++] = this._pos - curMatch3 - 1;
					curMatch2 = curMatch3;
				}
			}
			if (offset !== 0 && curMatch2 === curMatch) {
				offset -= 2;
				maxLen = kStartMaxLen;
			}
		}
		
		this._hash[kFixHashSize + hashValue] = this._pos;
		
		ptr0 = (this._cyclicBufferPos << 1) + 1;
		ptr1 = this._cyclicBufferPos << 1;
		
		len0 = len1 = kNumHashDirectBytes;
		
		if (kNumHashDirectBytes !== 0) {
			if (curMatch > matchMinPos) {
				if (this._bufferBase[this._bufferOffset + curMatch + kNumHashDirectBytes] !== this._bufferBase[cur + kNumHashDirectBytes]) {
					distances[offset++] = maxLen = kNumHashDirectBytes;
					distances[offset++] = this._pos - curMatch - 1;
				}
			}
		}
		
		count = this._cutValue;
		
		for (;;) {
			if (curMatch <= matchMinPos || count-- === 0) {
				this._son[ptr0] = this._son[ptr1] = kEmptyHashValue;
				break;
			}
			
			delta = this._pos - curMatch;
			cyclicPos = ((delta <= this._cyclicBufferPos) ?
				(this._cyclicBufferPos - delta) :
				(this._cyclicBufferPos - delta + this._cyclicBufferSize)) << 1;
				
			pby1 = this._bufferOffset + curMatch;
			len = len0 < len1 ? len0 : len1;
			if (this._bufferBase[pby1 + len] === this._bufferBase[cur + len]) {
				while (++len !== lenLimit) {
					if (this._bufferBase[pby1 + len] !== this._bufferBase[cur + len]) {
						break;
					}
				}
				if (maxLen < len) {
					distances[offset++] = maxLen = len;
					distances[offset++] = delta - 1;
					if (len === lenLimit) {
						this._son[ptr1] = this._son[cyclicPos];
						this._son[ptr0] = this._son[cyclicPos + 1];
						break;
					}
				}
			}
			if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
				this._son[ptr1] = curMatch;
				ptr1 = cyclicPos + 1;
				curMatch = this._son[ptr1];
				len1 = len;
			} else {
				this._son[ptr1] = curMatch;
				ptr0 = cyclicPos;
				curMatch = this._son[ptr0];
				len0 = len;
			}
		}
		
		this.movePos();
		return offset;
	};
	
	this.skip = function(num) {
		var lenLimit, matchMinPos, cur, curMatch, hashValue, hash2Value, hash3Value, temp;
		var ptr0, ptr1, len0, len1, count, delta, cyclicPos, pby1, len;
		do {
			if (this._pos + this._matchMaxLen <= this._streamPos) {
				lenLimit = this._matchMaxLen;
			} else {
				lenLimit = this._streamPos - this._pos;
				if (lenLimit < kMinMatchCheck) {
					this.movePos();
					continue;
				}
			}
			
			matchMinPos = this._pos > this._cyclicBufferSize ? (this._pos - this._cyclicBufferSize) : 0;
			cur = this._bufferOffset + this._pos;
			
			if (this.hashArray) {
				temp = CRC.table[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
				hash2Value = temp & (kHash2Size - 1);
				this._hash[hash2Value] = this._pos;
				temp ^= this._bufferBase[cur + 2] << 8;
				hash3Value = temp & (kHash3Size - 1);
				this._hash[kHash3Offset + hash3Value] = this._pos;
				hashValue = (temp ^ (CRC.table[this._bufferBase[cur + 3]] << 5)) & this._hashMask;
			} else {
				hashValue = this._bufferBase[cur] ^ (this._bufferBase[cur + 1] << 8);
			}
			
			curMatch = this._hash[kFixHashSize + hashValue];
			this._hash[kFixHashSize + hashValue] = this._pos;
			
			ptr0 = (this._cyclicBufferPos << 1) + 1;
			ptr1 = (this._cyclicBufferPos << 1);
			
			len0 = len1 = kNumHashDirectBytes;
			
			count = this._cutValue;
			for(;;) {
				if (curMatch <= matchMinPos || count-- === 0) {
					this._son[ptr0] = this._son[ptr1] = kEmptyHashValue;
					break;
				}
				
				delta = this._pos - curMatch;
				cyclicPos = (delta <= this._cyclicBufferPos ?
					(this._cyclicBufferPos - delta) :
					(this._cyclicBufferPos - delta + this._cyclicBufferSize)) << 1;
					
				pby1 = this._bufferOffset + curMatch;
				len = len0 < len1 ? len0 : len1;
				if (this._bufferBase[pby1 + len] === this._bufferBase[cur + len]) {
					while (++len !== lenLimit) {
						if (this._bufferBase[pby1 + len] !== this._bufferBase[cur + len]) {
							break;
						}
					}
					if (len === lenLimit) {
						this._son[ptr1] = this._son[cyclicPos];
						this._son[ptr0] = this._son[cyclicPos + 1];
						break;
					}
				}
				if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
					this._son[ptr1] = curMatch;
					ptr1 = cyclicPos + 1;
					curMatch = this._son[ptr1];
					len1 = len;
				} else {
					this._son[ptr0] = curMatch;
					ptr0 = cyclicPos;
					curMatch = this._son[ptr0];
					len0 = len;
				}
			}
			this.movePos();
		} while (--num !== 0);
	};
	
	this.normalizeLinks = function(items, numItems, subValue) {
		var i, value;
		for (i = 0; i < numItems; i++) {
			value = items[i];
			if (value <= subValue) {
				value = kEmptyHashValue;
			} else {
				value -= subValue;
			}
			items[i] = value;
		}
	};
	
	this.normalize = function() {
		var subValue = this._pos - this._cyclicBufferSize;
		this.normalizeLinks(this._son, this._cyclicBufferSize * 2, subValue);
		this.normalizeLinks(this._hash, this._hashSizeSum, subValue);
		this.reduceOffsets(subValue);
	};

	this.setCutValue = function() {
		this._cutValue = cutValue;
	};
}

BinTree.prototype = new InWindow();

exports.CRC = new CRC();
exports.InWindow = InWindow;
exports.BinTree = BinTree;