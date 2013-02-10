# lzmajs

`lzmajs` is a fast pure-JavaScript implementation of LZMA
compression/decompression.  It was originally written by Gary Linscott
based on decompression code by Juan Mellado and the 7-Zip SDK.
C. Scott Ananian cleaned up the source code and packaged it for `node`
and `volo`.

## How to install

```
npm install lzmajs
```
or
```
volo add cscott/lzmajs
```

## Usage

There is an LZMA-JS compatible interface as well:

    LZMA.compress(string, mode, on_finish(result) {}, on_progress(percent) {});

    LZMA.decompress(byte_array, on_finish(result) {}, on_progress(percent) {});

## Documentation

## Related projects

* http://code.google.com/p/js-lzma Decompression code by Juan Mellado
* http://code.google.com/p/gwt-lzma/ and https://github.com/nmrugg/LZMA-JS
  are ports of the original Java code in the 7-Zip SDK
  using the GWT Java-to-JavaScript compiler.

## License

> Copyright (c) 2011 Gary Linscott
>
> Copyright (c) 2011-2012 Juan Mellado
>
> Copyright (c) 2013 C. Scott Ananian
>
> All rights reserved.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
