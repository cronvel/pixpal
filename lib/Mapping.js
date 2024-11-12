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
function Mapping( matrix , alphaChannelDst ) {
	this.matrix = matrix ;
	this.alphaChannelDst = alphaChannelDst ?? null ;
	this.composeChannelOrder = null ;

	if ( this.alphaChannelDst === null ) {
		this.compose = this.map ;
	}
	else {
		this.composeChannelOrder = [ this.alphaChannelDst ] ;
		for ( let i = 0 ; i < this.dstChannels ; i ++ ) {
			if ( i !== this.alphaChannelDst ) { this.composeChannelOrder.push( i ) ; }
		}
	}
}

Mapping.prototype.map = function() {} ;
Mapping.prototype.compose = function() {} ;
module.exports = Mapping ;



function clampUint8( value ) { return Math.max( 0 , Math.min( 255 , Math.round( value ) ) ) ; }
function normalizedToUint8( value ) { return Math.max( 0 , Math.min( 255 , Math.round( 255 * value ) ) ) ; }
function uint8ToNormalized( value ) { return Math.max( 0 , Math.min( 1 , value / 255 ) ) ; }

const NO_COMPOSITING = {
	alpha: ( alphaSrc /*, alphaDst */ ) => alphaSrc ,
	channel: ( alphaSrc , alphaDst , channelSrc /*, channelDst */ ) => channelSrc
} ;



/*
	Direct mapping of dst to src, each dst channel is copied from a src channel.
	Each entry is a src channel index.
*/
function DirectChannelMapping( matrix , alphaChannelDst ) {
	this.dstChannels = matrix.length ;
	Mapping.call( this , matrix , alphaChannelDst ) ;
}

DirectChannelMapping.prototype = Object.create( Mapping.prototype ) ;
DirectChannelMapping.prototype.constructor = DirectChannelMapping ;
Mapping.DirectChannelMapping = DirectChannelMapping ;

DirectChannelMapping.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		dst.buffer[ iDst + cDst ] = srcBuffer[ iSrc + this.matrix[ cDst ] ] ;
	}
} ;

DirectChannelMapping.prototype.compose = function( src , dst , iSrc , iDst , compositing = NO_COMPOSITING , srcBuffer = src.buffer ) {
	let alphaDst = dst.buffer[ iDst + this.alphaChannelDst ] / 255 ;
	let alphaSrc = 1 ;

	for ( let cDst of this.composeChannelOrder ) {
		if ( cDst === this.alphaChannelDst ) {
			alphaSrc = srcBuffer[ iSrc + this.matrix[ cDst ] ] / 255 ;
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.alpha( alphaSrc , alphaDst ) ) ;
		}
		else {
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.channel(
				alphaSrc ,
				alphaDst ,
				srcBuffer[ iSrc + this.matrix[ cDst ] ] / 255 ,
				dst.buffer[ iDst + cDst ] / 255
			) ) ;
		}
	}
} ;



/*
	Direct mapping of dst to src, each dst channel is copied from a src channel OR have a default value.
	There are 2 entries per dst channel, the first one is a src channel index, the second one is a default value.
	The default value is used unless its value is null.
*/
function DirectChannelMappingWithDefault( matrix , alphaChannelDst ) {
	this.dstChannels = Math.floor( matrix.length / 2 ) ;
	Mapping.call( this , matrix , alphaChannelDst ) ;
}

DirectChannelMappingWithDefault.prototype = Object.create( Mapping.prototype ) ;
DirectChannelMappingWithDefault.prototype.constructor = DirectChannelMappingWithDefault ;
Mapping.DirectChannelMappingWithDefault = DirectChannelMappingWithDefault ;

DirectChannelMappingWithDefault.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		dst.buffer[ iDst + cDst ] = this.matrix[ cDst * 2 + 1 ] ?? srcBuffer[ iSrc + this.matrix[ cDst * 2 ] ] ;
	}
} ;

DirectChannelMappingWithDefault.prototype.compose = function( src , dst , iSrc , iDst , compositing = NO_COMPOSITING , srcBuffer = src.buffer ) {
	let alphaDst = dst.buffer[ iDst + this.alphaChannelDst ] / 255 ;
	let alphaSrc = 1 ;

	for ( let cDst of this.composeChannelOrder ) {
		if ( cDst === this.alphaChannelDst ) {
			alphaSrc = ( this.matrix[ cDst * 2 + 1 ] ?? srcBuffer[ iSrc + this.matrix[ cDst * 2 ] ] ) / 255 ;
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.alpha( alphaSrc , alphaDst ) ) ;
		}
		else {
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.channel(
				alphaSrc ,
				alphaDst ,
				( this.matrix[ cDst * 2 + 1 ] ?? srcBuffer[ iSrc + this.matrix[ cDst * 2 ] ] ) / 255 ,
				dst.buffer[ iDst + cDst ] / 255
			) ) ;
		}
	}
} ;



/*
	Matrix mapping of the dst to src, each dst channel is composed by all src channels + one additional value.
	There are ( srcChannelsUsed + 1 ) entries per dst channel, the last one is the additionnal value.
*/
function MatrixChannelMapping( matrix , srcChannelsUsed , alphaChannelDst ) {
	this.dstChannels = Math.floor( matrix.length / ( srcChannelsUsed + 1 ) ) ;
	this.srcChannelsUsed = srcChannelsUsed ;
	Mapping.call( this , matrix , alphaChannelDst ) ;
}

MatrixChannelMapping.prototype = Object.create( Mapping.prototype ) ;
MatrixChannelMapping.prototype.constructor = MatrixChannelMapping ;
Mapping.MatrixChannelMapping = MatrixChannelMapping ;

MatrixChannelMapping.prototype.map = function( src , dst , iSrc , iDst , srcBuffer = src.buffer ) {
	let matrixIndex = 0 ;

	for ( let cDst = 0 ; cDst < dst.channels ; cDst ++ ) {
		let value = 0 ;

		for ( let cSrc = 0 ; cSrc < this.srcChannelsUsed ; cSrc ++ ) {
			value += srcBuffer[ iSrc + cSrc ] * this.matrix[ matrixIndex ++ ] ;
		}

		value += this.matrix[ matrixIndex ++ ] ;	// This is the additionnal value

		dst.buffer[ iDst + cDst ] = clampUint8( value ) ;
	}
} ;

MatrixChannelMapping.prototype.compose = function( src , dst , iSrc , iDst , compositing = NO_COMPOSITING , srcBuffer = src.buffer ) {
	let alphaDst = dst.buffer[ iDst + this.alphaChannelDst ] / 255 ;
	let alphaSrc = 1 ;

	for ( let cDst of this.composeChannelOrder ) {
		let matrixIndex = cDst * ( this.srcChannelsUsed + 1 ) ;
		let value = 0 ;

		for ( let cSrc = 0 ; cSrc < this.srcChannelsUsed ; cSrc ++ ) {
			value += srcBuffer[ iSrc + cSrc ] * this.matrix[ matrixIndex ++ ] ;
		}

		value += this.matrix[ matrixIndex ++ ] ;	// This is the additionnal value
		value = uint8ToNormalized( value ) ;

		if ( cDst === this.alphaChannelDst ) {
			// Always executed at the first loop iteration
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.alpha( value , alphaDst ) ) ;
		}
		else {
			dst.buffer[ iDst + cDst ] = normalizedToUint8( compositing.channel(
				alphaSrc ,
				alphaDst ,
				value ,
				dst.buffer[ iDst + cDst ] / 255
			) ) ;
		}
	}
} ;



/*
	Built-in channel mapping.
	Should come after prototype definition, because of *.prototype = Object.create(...)
*/

Mapping.RGBA_COMPATIBLE_TO_RGBA = new DirectChannelMapping( [ 0 , 1 , 2 , 3 ] , 3 ) ;

Mapping.RGB_COMPATIBLE_TO_RGBA = new DirectChannelMappingWithDefault(
	[
		0 , null ,
		1 , null ,
		2 , null ,
		null , 255
	] ,
	3
) ;

Mapping.GRAY_ALPHA_COMPATIBLE_TO_RGBA = new DirectChannelMapping( [ 0 , 0 , 0 , 1 ] , 3 ) ;

Mapping.GRAY_COMPATIBLE_TO_RGBA = new DirectChannelMappingWithDefault(
	[
		0 , null ,
		0 , null ,
		0 , null ,
		null , 255
	] ,
	3
) ;

Mapping.RGBA_COMPATIBLE_TO_GRAY_ALPHA = new MatrixChannelMapping(
	[
		1 / 3 , 1 / 3 , 1 / 3 , 0 , 0 ,
		0 , 0 , 0 , 1 , 0
	] ,
	4 ,
	1
) ;

Mapping.RGB_COMPATIBLE_TO_GRAY_ALPHA = new MatrixChannelMapping(
	[
		1 / 3 , 1 / 3 , 1 / 3 , 0 ,
		0 , 0 , 0 , 255
	] ,
	3 ,
	1
) ;

