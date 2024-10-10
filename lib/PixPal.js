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



const Png = require( './Png.js' ) ;



function PixPal( width , height , palette , pixels ) {
	this.width = width ;
	this.height = height ;
	this.palette = null ;
	this.pixels = null ;
	
	if ( Array.isArray( palette ) ) {
		this.palette = palette ;
	}
	else {
		this.palette = [] ;
	}

	if ( pixels ) {
		if ( ! ( pixels instanceof Uint8ClampedArray ) ) {
			throw new Error( "Provided pixel buffer is not a Uint8ClampedArray" ) ;
		}

		if ( pixels.length !== this.width * this.height ) {
			throw new Error( "Provided pixel buffer mismatch the expected size (should be exactly width * height)" ) ;
		}

		this.pixels = pixels ;
	}
	else {
		this.pixels = new Uint8ClampedArray( width * height ) ;
	}
}

module.exports = PixPal ;



PixPal.prototype.createImageData = function() {
	var imageData = new ImageData( this.width , this.height ) ;
	this.updateImageData( imageData ) ;
	return imageData ;
} ;



PixPal.prototype.updateImageData = function( imageData ) {
	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateImageData(): width or height mismatch" ) ;
	}
	
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iDest = i * 4 ;
		let color = this.palette[ this.pixels[ i ] ] ;
		imageData.data[ iDest ] = color[ 0 ] ;	// Red
		imageData.data[ iDest + 1 ] = color[ 0 ] ;	// Green
		imageData.data[ iDest + 2 ] = color[ 0 ] ;	// Blue
		imageData.data[ iDest + 3 ] = color[ 0 ] ;	// Alpha
	}
} ;



PixPal.decodePngBuffer = async ( buffer , options ) => {
	var png = await Png.decode( buffer , options ) ;
	
	if ( png.colorType !== Png.COLOR_TYPE_INDEXED || png.decodedBytesPerPixel !== 1 ) {
		throw new Error( "Unsupported PNG, only supporting indexed color and 8 bits per pixels output" ) ;
	}

	var pixPal = new PixPal( png.width , png.height , png.palette , png.imageData ) ;
} ;

