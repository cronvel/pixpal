/*
	PixPal

	Copyright (c) 2024 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const compositing = {} ;
module.exports = compositing ;



// The normal alpha-blending mode, a “top” layer replacing a “bottom” one.
compositing.normal = compositing.over = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc + alphaDst * ( 1 - alphaSrc ) ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) =>
		( channelSrc * alphaSrc + channelDst * alphaDst * ( 1 - alphaSrc ) ) / ( alphaSrc + alphaDst * ( 1 - alphaSrc ) ) || 0
} ;

// Like normal/over, but alpha is considered fully transparent (=0) or fully opaque (≥1).
compositing.binaryOver = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc ? 1 : alphaDst ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) => alphaSrc ? channelSrc : channelDst
} ;

// This intersect the src and the dst for alpha, while using the same method than “over” for the channel.
// The result is opaque only where both are opaque.
compositing.in = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc * alphaDst ,
	channel: compositing.normal.channel
} ;

// Src is only copied where dst is transparent, it's like a “in” with dst alpha inverted.
compositing.out = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc * ( 1 - alphaDst ) ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) =>
		( channelSrc * alphaSrc + channelDst * ( 1 - alphaDst ) * ( 1 - alphaSrc ) ) / ( alphaSrc + ( 1 - alphaDst ) * ( 1 - alphaSrc ) ) || 0
} ;

// Src is only copied where both src and dst are opaque, opaque dst area are left untouched where src is transparent.
// It uses the same method than “over” for the channel.
compositing.atop = {
	alpha: ( alphaSrc , alphaDst ) => compositing.normal.alpha( alphaSrc , alphaDst ) * alphaDst ,
	channel: compositing.normal.channel
} ;

// This use an analogic xor for alpha, while using the same method than “over” for the channel.
// The result is opaque only where only one is opaque.
compositing.xor = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc * ( 1 - alphaDst ) + alphaDst * ( 1 - alphaSrc ) ,
	channel: compositing.normal.channel
} ;



// Advanced compositing methods.
// See: https://en.wikipedia.org/wiki/Alpha_compositing

// Multiply, always produce darker output
compositing.multiply = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
		channelSrc * ( 1 + ( channelDst - 1 ) * alphaDst ) ,
		channelDst
	)
} ;

// Inverse of multiply, always produce brighter output
compositing.screen = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
		1 - ( 1 - channelSrc ) * ( 1 - channelDst * alphaDst ) ,
		channelDst
	)
} ;

// Overlay, either a screen or a multiply, with a factor 2.
compositing.overlay = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
			// Got trouble making it work with dst alpha channel, the original resources just check if dst < 0.5,
			// I made it three-way to solve issues when dst has low or transparency alpha, so that is color info
			// doesn't affect the blending color.
			1 + ( channelDst - 1 ) * alphaDst < 0.5   ?   2 * channelSrc * ( 1 + ( channelDst - 1 ) * alphaDst )       :
			channelDst * alphaDst > 0.5               ?   1 - 2 * ( 1 - channelSrc ) * ( 1 - channelDst * alphaDst )   :
			channelSrc ,
		channelDst
	)
} ;

