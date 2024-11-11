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



// The normal alpha-blending mode
compositing.normal = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc + alphaDst * ( 1 - alphaSrc ) ,
	channel: ( alphaSrc , alphaDst , alphaRes , channelSrc , channelDst ) =>
		( channelSrc * alphaSrc + channelDst * alphaDst * ( 1 - alphaSrc ) ) / alphaRes || 0
} ;

// Alpha is considered fully transparent (=0) or fully opaque (≥1)
compositing.mask = {
	alpha: ( alphaSrc , alphaDst ) => alphaSrc ? 1 : alphaDst ,
	channel: ( alphaSrc , alphaDst , alphaRes , channelSrc , channelDst ) => alphaSrc ? channelSrc : channelDst
} ;

// Advanced compositing methods.
// See: https://en.wikipedia.org/wiki/Alpha_compositing

// Multiply, always produce darker output
compositing.multiply = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , alphaRes , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
		alphaRes ,
		channelSrc * ( channelDst * alphaDst + ( 1 - alphaDst ) ) ,
		channelDst
	)
} ;

// Inverse of multiply, always produce brighter output
compositing.screen = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , alphaRes , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
		alphaRes ,
		1 - ( 1 - channelSrc ) * ( 1 - channelDst * alphaDst ) ,
		channelDst
	)
} ;

// Overlay, either a screen or a multiply, with a factor 2.
// Not working ATM, the factor 2 is not working well with alpha blending.
compositing.overlay = {
	alpha: compositing.normal.alpha ,
	channel: ( alphaSrc , alphaDst , alphaRes , channelSrc , channelDst ) => compositing.normal.channel(
		alphaSrc ,
		alphaDst ,
		alphaRes ,
		channelDst * alphaDst + ( 1 - alphaDst ) < 0.5 ?
			2 * channelSrc * ( channelDst * alphaDst + ( 1 - alphaDst ) ) :
			1 - 2 * ( 1 - channelSrc ) * ( 1 - channelDst * alphaDst ) ,
		channelDst
	)
} ;




