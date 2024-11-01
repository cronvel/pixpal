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


/*
	Params:
		width: image width in pixel
		height: image height in pixel
		channels: the channels, default to [ 'R' , 'G' , 'B' , 'A' ] or PortableImage.RGBA
		indexed: (boolean) it uses a palette, up to 256 entries, each pixel is a 1-Byte index
		palette: (array of array of integers) force indexed a pass an array of array of channel value
		pixelBuffer: (Buffer or Uint8Array) the buffer containing all the pixel data
*/
function PortableImage( params = {} ) {
	this.width = width ;
	this.height = height ;
	this.channels = Array.isArray( channels ) ? channels : PortableImage.RGBA ;
	this.indexed = palette === true || Array.isArray( palette ) ;
	this.bytesPerPixel = this.indexed ? 1 : this.channels.length ;
	this.palette = this.indexed ? [] : null ;

	if ( pixelBuffer ) {
		if ( pixelBuffer instanceof Buffer ) {
			if ( pixelBuffer.length !== this.width * this.height * this.bytesPerPixel ) {
				throw new Error( "Provided pixel Buffer mismatch the expected size (should be exactly width * height * bytesPerPixel)" ) ;
			}
		}
		else if ( pixelBuffer instanceof Uint8Array ) {
			if ( pixelBuffer.length !== this.width * this.height * this.bytesPerPixel ) {
				throw new Error( "Provided pixel Uint8Array buffer mismatch the expected size (should be exactly width * height * bytesPerPixel)" ) ;
			}

			pixelBuffer = Buffer.from( pixelBuffer ) ;
		}
		else {
			throw new Error( "Provided pixel buffer is not a Buffer or a Uint8Array" ) ;
		}

		this.pixelBuffer = pixelBuffer ;
	}
	else {
		this.pixelBuffer = new Buffer( this.width * this.height * this.bytesPerPixel ) ;
	}

	if ( Array.isArray( palette ) ) {
		this.setPalette( palette ) ;
	}
	
	this.channelIndex = {} ;
	for ( let i = 0 ; i < this.channels.length ; i ++ ) {
		this.channelIndex[ this.channels[ i ] ] = i ;
	}

	this.isRGBCompatible = this.channels.length >= 3 && this.channels[ 0 ] === 'R' && this.channels[ 1 ] === 'G' && this.channels[ 2 ] === 'B' ;
	this.isRGBACompatible = this.channels.length >= 4 && this.isRGBCompatible && this.channels[ 3 ] === 'A' ;
	this.isRGB = this.isRGBCompatible && this.channels.length === 3 ;
	this.isRGBA = this.isRGBACompatible && this.channels.length === 4 ;
}

module.exports = PortableImage ;



PortableImage.RGB = [ 'R' , 'G' , 'B' ] ;
PortableImage.RGBA = [ 'R' , 'G' , 'B' , 'A' ] ;




PortableImage.prototype.setPalette = function( palette ) {
	if ( ! this.indexed ) { throw new Error( "This is not an indexed image" ) ; }

	this.palette.length = 0 ;

	for ( let index = 0 ; index < palette.length ; index ++ ) {
		this.setPaletteEntry( index , palette[ index ] ) ;
	}
} ;



PortableImage.prototype.setPaletteEntry = function( index , entry ) {
	if ( this.isRGB || this.isRGBA ) { return this.setPaletteColor( index , entry ) ; }

	if ( ! this.indexed ) { throw new Error( "This is not an indexed image" ) ; }
	if ( ! entry ) { return ; }

	if ( Array.isArray( color ) ) {
		for ( let i = 0 ; i < this.channels.length ; i ++ ) {
			currentColor[ i ] = entry[ i ] ?? 0 ;
		}
	}
	else if ( typeof color === 'object' ) {
		for ( let i = 0 ; i < this.channels.length ; i ++ ) {
			currentColor[ i ] = entry[ this.channels[ i ] ] ?? 0 ;
		}
	}
} ;



const LESSER_BYTE_MASK = 0xff ;

PortableImage.prototype.setPaletteColor = function( index , color ) {
	if ( ! this.indexed ) { throw new Error( "This is not an indexed image" ) ; }
	if ( ! color ) { return ; }

	var currentColor = this.palette[ index ] ;
	if ( ! currentColor ) { currentColor = this.palette[ index ] = [] ; }

	if ( Array.isArray( color ) ) {
		currentColor[ 0 ] = color[ 0 ] ?? 0 ;
		currentColor[ 1 ] = color[ 1 ] ?? 0 ;
		currentColor[ 2 ] = color[ 2 ] ?? 0 ;
		if ( this.isRGBA ) { currentColor[ 3 ] = color[ 3 ] ?? 255 ; }
	}
	else if ( typeof color === 'object' ) {
		currentColor[ 0 ] = color.R ?? color.r ?? 0 ;
		currentColor[ 1 ] = color.G ?? color.g ?? 0 ;
		currentColor[ 2 ] = color.B ?? color.b ?? 0 ;
		if ( this.isRGBA ) { currentColor[ 3 ] = color.A ?? color.a ?? 255 ; }
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
			if ( this.isRGBA ) { currentColor[ 3 ] = 255 ; }
		}
		else if ( color.length === 8 ) {
			currentColor[ 0 ] = ( code >> 24 ) & LESSER_BYTE_MASK ;
			currentColor[ 1 ] = ( code >> 16 ) & LESSER_BYTE_MASK ;
			currentColor[ 2 ] = ( code >> 8 ) & LESSER_BYTE_MASK ;
			if ( this.isRGBA ) { currentColor[ 3 ] = code & LESSER_BYTE_MASK ; }
		}
	}
} ;



// Simple color matcher
PortableImage.prototype.getPaletteClosestIndex = ( channels ) => {
	var cMax = Math.min( this.channels.length , channels.length ) ,
		minDist = Infinity ,
		minIndex = 0 ;

	for ( let index = 0 ; index < this.palette.length ; index ++ ) {
		let dist = 0 ;

		for ( let c = 0 ; c < cMax ; c ++ ) {
			let delta = this.palette[ index ][ c ] - channels[ c ] ;
			dist += delta * delta ;

			if ( dist < minDist ) {
				minDist = dist ;
				minIndex = index ;
			}
		}
	}

	return index ;
} ;



PortableImage.RGB_MAPPING = [ 0 , 1 , 2 ] ;
PortableImage.RGBA_MAPPING = [ 0 , 1 , 2 , 3 ] ;

PortableImage.prototype.createImageData = function( mapping ) {
	var imageData = new ImageData( this.width , this.height ) ;
	this.updateImageData( imageData , mapping ) ;
	return imageData ;
} ;



PortableImage.prototype.updateImageData = function( imageData , mapping ) {
	if ( ! mapping ) {
		if ( this.isRGBACompatible ) { mapping = PortableImage.RGBA_MAPPING ; }
		else if ( this.isRGBCompatible ) { mapping = PortableImage.RGB_MAPPING ; }
		else { throw new Error( "Mapping required for image that are not RGB/RGBA compatible" ) ; }
	}

	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateImageData(): width and/or height mismatch" ) ;
	}

	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDest = i * 4 ;
		let src = this.pixelBuffer ;

		if ( this.indexed ) {
			src = this.palette[ this.pixelBuffer[ iSrc ] ] ;
			iSrc = 0 ;
		}

		imageData.data[ iDest ] = src[ iSrc + mapping[ 0 ] ] ;		// Red
		imageData.data[ iDest + 1 ] = src[ iSrc + mapping[ 1 ] ] ;	// Green
		imageData.data[ iDest + 2 ] = src[ iSrc + mapping[ 2 ] ] ;	// Blue
		imageData.data[ iDest + 3 ] = src[ iSrc + mapping[ 3 ] ] ?? 255 ;	// Alpha
	}
} ;



PortableImage.updateFromImageData = function( imageData , mapping ) {
	if ( ! mapping ) {
		if ( this.isRGBACompatible ) { mapping = PortableImage.RGBA_MAPPING ; }
		else if ( this.isRGBCompatible ) { mapping = PortableImage.RGB_MAPPING ; }
		else { throw new Error( "Mapping required for image that are not RGB/RGBA compatible" ) ; }
	}

	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateFromImageData(): width and/or height mismatch" ) ;
	}
	
	/*
	var rMapping = new Array( mapping.length ) ;
	for ( let i = 0 ; i < mapping.length ; i ++ ) {
		rMapping[ mapping[ i ] ] = i ;
	}
	*/

	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iDest = i * this.bytesPerPixel ;
		let iSrc = i * 4 ;
		//let src = imageData ;


// /!\ TODO /!\ ---------------------------------------------------------------------------------------------


		if ( this.indexed ) {
			let colorIndex = this.getPaletteClosestIndex( [
				imageData.data[ iDest ] ,		// red
				imageData.data[ iDest + 1 ] ,	// green
				imageData.data[ iDest + 2 ] ,	// blue
				imageData.data[ iDest + 3 ]		// alpha
			] ) ;

			this.pixelBuffer[ iDest ] = colorIndex ;
		}

		this.pixelBuffer[ iDest + mapping[ 0 ] ] = imageData[ iSrc ] ;
		this.pixelBuffer[ iDest + mapping[ 1 ] ] = imageData[ iSrc + 1 ] ;
		this.pixelBuffer[ iDest + mapping[ 2 ] ] = imageData[ iSrc + 2 ] ;
		this.pixelBuffer[ iDest + mapping[ 3 ] ] = imageData[ iSrc + 3 ] ;
	}

	return pixPal ;
} ;

