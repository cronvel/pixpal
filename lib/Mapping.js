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



// Base class
function Mapping() {
	throw new Error( "Cannot instanciate the base Mapping class, use derived classes instead" ) ;
}
Mapping.prototype.map = function() {} ;
module.exports = Mapping ;


/*
	Direct mapping of dst to src, each dst channel is copied from a src channel.
	Each entry is a src channel index.
*/
function DirectChannelMapping( matrix ) {
	this.matrix = matrix ;
}

DirectChannelMapping.prototype = Object.create( Mapping.prototype ) ;
DirectChannelMapping.prototype.constructor = DirectChannelMapping ;
Mapping.DirectChannelMapping = DirectChannelMapping ;

DirectChannelMapping.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		dst.buffer[ iDst + cDst ] = srcBuffer[ iSrc + this.matrix[ cDst ] ] ;
	}
} ;



/*
	Direct mapping of dst to src, each dst channel is copied from a src channel OR have a default value.
	There are 2 entries per dst channel, the first one is a src channel index, the second one is a default value.
	The default value is used unless its value is null.
*/
function DirectChannelMappingWithDefault( matrix ) {
	this.matrix = matrix ;
}

DirectChannelMappingWithDefault.prototype = Object.create( Mapping.prototype ) ;
DirectChannelMappingWithDefault.prototype.constructor = DirectChannelMappingWithDefault ;
Mapping.DirectChannelMappingWithDefault = DirectChannelMappingWithDefault ;

DirectChannelMappingWithDefault.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		dst.buffer[ iDst + cDst ] = this.matrix[ cDst * 2 + 1 ] ?? srcBuffer[ iSrc + this.matrix[ cDst * 2 ] ] ;
	}
} ;



/*
	Composite mapping of the dst to src, each dst channel is composed by all src channels + one additional value.
	There are ( src channels + 1 ) entries per dst channel, the last one is the additionnal value.
*/
function CompositeChannelMapping( matrix , srcChannelsUsed ) {
	this.matrix = matrix ;
	this.srcChannelsUsed = srcChannelsUsed ;
}

CompositeChannelMapping.prototype = Object.create( Mapping.prototype ) ;
CompositeChannelMapping.prototype.constructor = CompositeChannelMapping ;
Mapping.CompositeChannelMapping = CompositeChannelMapping ;

CompositeChannelMapping.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	let matrixIndex = 0 ;

	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		let value = 0 ;

		for ( let cSrc = 0 ; cSrc < this.srcChannelsUsed ; cSrc ++ ) {
			value += srcBuffer[ iSrc + cSrc ] * this.matrix[ matrixIndex ++ ] ;
		}

		value += this.matrix[ matrixIndex ++ ] ;	// This is the additionnal value

		dst.buffer[ iDst + cDst ] = Math.max( 0 , Math.min( 255 , Math.round( value ) ) ) ;
	}
} ;



/*
	Built-in channel mapping.
	Should come after prototype definition, because of *.prototype = Object.create(...)
*/

Mapping.RGBA_COMPATIBLE_TO_RGBA = new DirectChannelMapping( [ 0 , 1 , 2 , 3 ] ) ;

Mapping.RGB_COMPATIBLE_TO_RGBA = new DirectChannelMappingWithDefault( [
	0 , null ,
	1 , null ,
	2 , null ,
	null , 255
] ) ;

Mapping.GRAY_ALPHA_COMPATIBLE_TO_RGBA = new DirectChannelMapping( [ 0 , 0 , 0 , 1 ] ) ;

Mapping.GRAY_COMPATIBLE_TO_RGBA = new DirectChannelMappingWithDefault( [
	0 , null ,
	0 , null ,
	0 , null ,
	null , 255
] ) ;

Mapping.RGBA_COMPATIBLE_TO_GRAY_ALPHA = new CompositeChannelMapping(
	[
		1 / 3 , 1 / 3 , 1 / 3 , 0 , 0 ,
		0 , 0 , 0 , 1 , 0
	] ,
	4
) ;

Mapping.RGB_COMPATIBLE_TO_GRAY_ALPHA = new CompositeChannelMapping(
	[
		1 / 3 , 1 / 3 , 1 / 3 , 0 ,
		0 , 0 , 0 , 255
	] ,
	3
) ;

