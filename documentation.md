
# PixPal

PixPal is a lib that intend to manipulate indexed images (mostly palette manipulation).

It supports indexed PNG read and write, both inside Node.js and browsers environment.

It's probably the most lightweight PNG loader/saver out there, written from scratch (because other PNG libs don't give you access
to the underlying indexed pixel data and palette, and instead create RGB buffers), it uses the CompressionStream API to avoid
zlib dependencies.
It only supports a subset of PNG (indexed PNG only, support for transparency, but no Adam7 support, no fancy features,
and the encoder is straightforward thus does not try to optimize the generated size).

