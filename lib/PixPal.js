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
	this.palette = [] ;

	if ( Array.isArray( palette ) ) {
		this.setPalette( palette ) ;
	}

	if ( pixels ) {
		if ( ! ( pixels instanceof Buffer ) ) {
			throw new Error( "Provided pixel buffer is not a Buffer" ) ;
		}

		if ( pixels.length !== this.width * this.height ) {
			throw new Error( "Provided pixel buffer mismatch the expected size (should be exactly width * height)" ) ;
		}

		this.pixels = pixels ;
	}
	else {
		this.pixels = new Buffer( width * height ) ;
	}
}

module.exports = PixPal ;

// Also exports:
PixPal.Png = Png ;



PixPal.prototype.setPalette = function( palette ) {
	this.palette.length = 0 ;

	for ( let index = 0 ; index < palette.length ; index ++ ) {
		this.setColor( index , palette[ index ] ) ;
	}
} ;



const LESSER_BYTE_MASK = 0xff ;

PixPal.prototype.setColor = function( index , color ) {
	if ( ! color ) { return ; }

	var currentColor = this.palette[ index ] ;
	if ( ! currentColor ) { currentColor = this.palette[ index ] = [] ; }

	if ( Array.isArray( color ) ) {
		currentColor[ 0 ] = color[ 0 ] ?? 0 ;
		currentColor[ 1 ] = color[ 1 ] ?? 0 ;
		currentColor[ 2 ] = color[ 2 ] ?? 0 ;
		currentColor[ 3 ] = color[ 3 ] ?? 255 ;
	}
	else if ( typeof color === 'object' ) {
		currentColor[ 0 ] = color.r ?? 0 ;
		currentColor[ 1 ] = color.g ?? 0 ;
		currentColor[ 2 ] = color.b ?? 0 ;
		currentColor[ 3 ] = color.a ?? 255 ;
	}
	else if ( typeof color === 'string' && color[ 0 ] === '#' ) {
		color = color.slice( 1 ) ;
		if ( color.length === 3 ) {
			color = color[ 0 ] + color[ 0 ] + color[ 1 ] + color[ 1 ] + color[ 2 ] + color[ 2 ] ;
		}

		let code = Number.parseInt( color , 16 ) ;

		if ( color.length === 6 ) {
			currentColor[ 0 ] = ( code >> 16 ) & LESSER_BYTE_MASK ;
			currentColor[ 1 ] = ( code >> 8 ) & LESSER_BYTE_MASK ;
			currentColor[ 2 ] = code & LESSER_BYTE_MASK ;
			currentColor[ 3 ] = 255 ;
		}
		else if ( color.length === 8 ) {
			currentColor[ 0 ] = ( code >> 24 ) & LESSER_BYTE_MASK ;
			currentColor[ 1 ] = ( code >> 16 ) & LESSER_BYTE_MASK ;
			currentColor[ 2 ] = ( code >> 8 ) & LESSER_BYTE_MASK ;
			currentColor[ 3 ] = code & LESSER_BYTE_MASK ;
		}
	}
} ;



PixPal.prototype.createImageData = function() {
	var imageData = new ImageData( this.width , this.height ) ;
	this.updateImageData( imageData ) ;
	return imageData ;
} ;



PixPal.prototype.updateImageData = function( imageData ) {
	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateImageData(): width and/or height mismatch" ) ;
	}

	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iDest = i * 4 ;
		let color = this.palette[ this.pixels[ i ] ] ;
		imageData.data[ iDest ] = color[ 0 ] ;	// Red
		imageData.data[ iDest + 1 ] = color[ 1 ] ;	// Green
		imageData.data[ iDest + 2 ] = color[ 2 ] ;	// Blue
		imageData.data[ iDest + 3 ] = color[ 3 ] ;	// Alpha
	}
} ;



// Convert RGBA to indexed
PixPal.updateFromImageData = function( imageData , options = {} ) {
	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateFromImageData(): width and/or height mismatch" ) ;
	}

	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSource = i * 4 ;

		let colorIndex = this.getClosestColor(
			imageData.data[ iDest ] ,		// red
			imageData.data[ iDest + 1 ] ,	// green
			imageData.data[ iDest + 2 ] ,	// blue
			imageData.data[ iDest + 3 ]		// alpha
		) ;

		if ( colorIndex === -1 ) {
			// Not found, fallback to zero
			this.pixels[ i ] = 0 ;
		}
		else {
			this.pixels[ i ] = colorIndex ;
		}
	}

	return pixPal ;
} ;



// Argument mode will be used to choose to compute distance in RGB or Lch.
// Only RGB is supported for instance.
PixPal.prototype.getClosestColor = ( r , g , b , a , mode = 'rgb' ) => {
	
} ;



PixPal.decodePngBuffer = async ( buffer , options = {} ) => {
	var png = await Png.decode( buffer , options ) ;
	return PixPal.fromPng( png , options ) ;
} ;



PixPal.loadPng = async ( url , options = {} ) => {
	var png = await Png.load( url , options ) ;
	return PixPal.fromPng( png , options ) ;
} ;



PixPal.fromPng = ( png , options = {} ) => {
	if ( png.colorType !== Png.COLOR_TYPE_INDEXED || png.decodedBytesPerPixel !== 1 ) {
		throw new Error( "Unsupported PNG, only supporting indexed color and 8 bits per pixels output" ) ;
	}

	var pixPal = new PixPal( png.width , png.height , png.palette , png.imageBuffer ) ;

	return pixPal ;
} ;



PixPal.prototype.encodePngBuffer = function( options = {} ) {
	var png = this.toPng( options ) ;
	return png.encode( options ) ;
} ;



PixPal.prototype.savePng = function( url , options = {} ) {
	var png = this.toPng( options ) ;
	return png.save( url , options ) ;	// we return for the promise
} ;



PixPal.prototype.downloadPng = function( filename , options = {} ) {
	var png = this.toPng( options ) ;
	return png.download( filename , options ) ;	// we return for the promise
} ;



PixPal.prototype.toPng = function( options = {} ) {
	var png = Png.createEncoder( {
		width: this.width ,
		height: this.height ,
		colorType: Png.COLOR_TYPE_INDEXED ,
		palette: this.palette ,
		imageBuffer: this.pixels
	} ) ;

	return png ;
} ;

