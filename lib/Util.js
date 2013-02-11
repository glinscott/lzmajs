if (typeof define !== 'function') { var define = require('amdefine')(module); }
define(['./freeze','./makeBuffer','./LZMA'],function(freeze,makeBuffer,LZMA){
'use strict';
/*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
References:
- "LZMA SDK" by Igor Pavlov
  http://www.7-zip.org/sdk.html
*/
/* Original source found at: http://code.google.com/p/js-lzma/ */

var Util = Object.create(null);

Util.decompress = function(properties, inStream, outStream, outSize){
  var decoder = new LZMA.Decoder();

  if ( !decoder.setDecoderProperties(properties) ){
    throw "Incorrect stream properties";
  }

  if ( !decoder.code(inStream, outStream, outSize) ){
    throw "Error in data stream";
  }

  return true;
};

/* Also accepts a Uint8Array/Buffer/array as first argument, in which case
 * returns the decompressed file as a Uint8Array/Buffer/array. */
Util.decompressFile = function(inStream, outStream){
  var decoder = new LZMA.Decoder(), outSize, i, mult;
  var retval = true;

  if (!('readByte' in inStream)) {
    var inBuffer = inStream;
    inStream = {
      size: inBuffer.length,
      pos: 0,
      readByte: function() { return inBuffer[this.pos++]; }
    };
  }

  if ( !decoder.setDecoderPropertiesFromStream(inStream) ){
    throw "Incorrect stream properties";
  }

  // largest integer in javascript is 2^53 (unless we use typed arrays)
  // but we don't explicitly check for overflow here.  caveat user.
  outSize = 0;
  for (i=0, mult=1; i<8; i++, mult*=256) {
    outSize += (inStream.readByte() * mult);
  }

  if (!(outStream && 'writeByte' in outStream)) {
    outStream = {
      buffer: makeBuffer(outSize),
      pos: 0,
      writeByte: function(byte) { this.buffer[this.pos++] = byte; }
    };
    retval = outStream.buffer;
  }

  if ( !decoder.code(inStream, outStream, outSize) ){
    throw "Error in data stream";
  }

  return retval;
};

return freeze(Util);
});
