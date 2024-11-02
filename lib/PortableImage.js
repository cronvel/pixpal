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
	this.width = params.width ;
	this.height = params.height ;
	this.channels = Array.isArray( params.channels ) ? params.channels : PortableImage.RGBA ;
	this.indexed = params.indexed || Array.isArray( params.palette ) ;
	this.bytesPerPixel = this.indexed ? 1 : this.channels.length ;
	this.palette = this.indexed ? [] : null ;
	this.pixelBuffer = null ;

	if ( params.pixelBuffer ) {
		if ( params.pixelBuffer instanceof Buffer ) {
			if ( params.pixelBuffer.length !== this.width * this.height * this.bytesPerPixel ) {
				throw new Error( "Provided pixel Buffer mismatch the expected size (should be exactly width * height * bytesPerPixel)" ) ;
			}

			this.pixelBuffer = params.pixelBuffer ;
		}
		else if ( params.pixelBuffer instanceof Uint8Array ) {
			if ( params.pixelBuffer.length !== this.width * this.height * this.bytesPerPixel ) {
				throw new Error( "Provided pixel Uint8Array buffer mismatch the expected size (should be exactly width * height * bytesPerPixel)" ) ;
			}

			this.pixelBuffer = Buffer.from( params.pixelBuffer ) ;
		}
		else {
			throw new Error( "Provided pixel buffer is not a Buffer or a Uint8Array" ) ;
		}
	}
	else {
		this.pixelBuffer = new Buffer( this.width * this.height * this.bytesPerPixel ) ;
	}

	if ( Array.isArray( params.palette ) ) {
		this.setPalette( params.palette ) ;
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

	var currentEntry = this.palette[ index ] ;
	if ( ! currentEntry ) { currentEntry = this.palette[ index ] = [] ; }

	if ( Array.isArray( entry ) ) {
		for ( let i = 0 ; i < this.channels.length ; i ++ ) {
			currentEntry[ i ] = entry[ i ] ?? 0 ;
		}
	}
	else if ( typeof entry === 'object' ) {
		for ( let i = 0 ; i < this.channels.length ; i ++ ) {
			currentEntry[ i ] = entry[ this.channels[ i ] ] ?? 0 ;
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
PortableImage.prototype.getClosestPaletteIndex = ( channelValues ) => {
	var cMax = Math.min( this.channels.length , channelValues.length ) ,
		minDist = Infinity ,
		minIndex = 0 ;

	for ( let index = 0 ; index < this.palette.length ; index ++ ) {
		let dist = 0 ;

		for ( let c = 0 ; c < cMax ; c ++ ) {
			let delta = this.palette[ index ][ c ] - channelValues[ c ] ;
			dist += delta * delta ;

			if ( dist < minDist ) {
				minDist = dist ;
				minIndex = index ;
			}
		}
	}

	return minIndex ;
} ;



PortableImage.RGB_MAPPING = [ 0 , 1 , 2 ] ;
PortableImage.RGBA_MAPPING = [ 0 , 1 , 2 , 3 ] ;



/*
	Copy to another PortableImage instance.
*/
PortableImage.prototype.copyTo = function( portableImage ) {
	
	let src = {
		buffer: this.pixelBuffer ,
		width: this.width ,
		height: this.height ,
		bytesPerPixel: this.bytesPerPixel ,
		x: 0 ,
		y: 0 ,
		endX: this.width ,
		endY: this.height
	} ;

	let dst = {
		buffer: portableImage.pixelBuffer ,
		width: portableImage.width ,
		height: portableImage.height ,
		bytesPerPixel: portableImage.bytesPerPixel ,
		x: 0 ,
		y: 0 ,
		endX: portableImage.width ,
		endY: portableImage.height ,

		scaleX: 1 ,
		scaleY: 1 ,
		channelValues: mapping.length === 3 ? [ null , null , null , 255 ] : [] ,
		channelMapping: mapping
	} ;
	console.log( "### Mapping: " , mapping ) ;

	if ( this.indexed ) {
		src.palette = this.palette ;
		PortableImage.indexedBlit( src , dst ) ;
	}
	else {
		PortableImage.blit( src , dst ) ;
	}
} ;



PortableImage.prototype.createImageData = function( params = {} ) {
	var scaleX = params.scaleX ?? params.scale ?? 1 ,
		scaleY = params.scaleY ?? params.scale ?? 1 ;

	var imageData = new ImageData( this.width * scaleX , this.height * scaleY ) ;
	this.updateImageData( imageData , params ) ;
	return imageData ;
} ;



PortableImage.prototype.updateImageData = function( imageData , params = {} ) {
	var mapping = params.mapping ,
		scaleX = params.scaleX ?? params.scale ?? 1 ,
		scaleY = params.scaleY ?? params.scale ?? 1 ;

	if ( ! mapping ) {
		if ( this.isRGBACompatible ) { mapping = PortableImage.RGBA_MAPPING ; }
		else if ( this.isRGBCompatible ) { mapping = PortableImage.RGB_MAPPING ; }
		else { throw new Error( "Mapping required for image that are not RGB/RGBA compatible" ) ; }
	}

	/*
	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateImageData(): width and/or height mismatch" ) ;
	}
	*/

	let src = {
		buffer: this.pixelBuffer ,
		width: this.width ,
		height: this.height ,
		bytesPerPixel: this.bytesPerPixel ,
		x: 0 ,
		y: 0 ,
		endX: this.width ,
		endY: this.height
	} ;

	if ( mapping.length < 4 ) {
		mapping = [ ... mapping ] ;
		for ( let i = mapping.length ; i < 4 ; i ++ ) { mapping[ i ] = - 1 ; }
	}

	let dst = {
		buffer: imageData.data ,
		width: imageData.width ,
		height: imageData.height ,
		bytesPerPixel: 4 ,
		x: 0 ,
		y: 0 ,
		endX: imageData.width ,
		endY: imageData.height ,
		scaleX ,
		scaleY ,
		channelValues: [ 0 , 0 , 0 , 255 ] ,
		channelMapping: mapping
	} ;

	if ( this.indexed ) {
		src.palette = this.palette ;
		PortableImage.indexedBlit( src , dst ) ;
	}
	else {
		PortableImage.blit( src , dst ) ;
	}

	return ;


	// This blit is faster, it could be useful to keep it when blitting from RGB -> RGBA with the same geometry
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDst = i * 4 ;
		let srcBuffer = this.pixelBuffer ;

		if ( this.indexed ) {
			srcBuffer = this.palette[ this.pixelBuffer[ iSrc ] ] ;
			iSrc = 0 ;
		}

		imageData.data[ iDst ] = srcBuffer[ iSrc + mapping[ 0 ] ] ;		// Red
		imageData.data[ iDst + 1 ] = srcBuffer[ iSrc + mapping[ 1 ] ] ;	// Green
		imageData.data[ iDst + 2 ] = srcBuffer[ iSrc + mapping[ 2 ] ] ;	// Blue
		imageData.data[ iDst + 3 ] = srcBuffer[ iSrc + mapping[ 3 ] ] ?? 255 ;	// Alpha
	}
} ;



/*
	src, dst:
		* buffer: array-like
		* width,height: geometry stored in the array-like
		* bytesPerPixel
		* x,y: coordinate where to start copying (included)
		* endX,endY: coordinate where to stop copying (excluded)
	dst:
		* scaleX,scaleY: drawing scale (nearest)
		* channelValues: an array of values for each channel, if a value is null/undefined, we got it from the channel mapping
		* channelMapping: the mapping of the channel from src to dst
*/
PortableImage.blit = function( src , dst ) {
	var blitWidth = Math.min( dst.endX - dst.x , ( src.endX - src.x ) * dst.scaleX ) ,
		blitHeight = Math.min( dst.endY - dst.y , ( src.endY - src.y ) * dst.scaleY ) ,
		channels = dst.channelMapping.length ;

	for ( let yOffset = 0 ; yOffset < blitHeight ; yOffset ++ ) {
		for ( let xOffset = 0 ; xOffset < blitWidth ; xOffset ++ ) {
			let iDst = ( ( dst.y + yOffset ) * dst.width + ( dst.x + xOffset ) ) * dst.bytesPerPixel ;
			let iSrc = ( Math.floor( src.y + yOffset / dst.scaleY ) * src.width + Math.floor( src.x + xOffset / dst.scaleX ) ) * src.bytesPerPixel ;

			for ( let c = 0 ; c < channels ; c ++ ) {
				dst.buffer[ iDst + c ] =
					dst.channelMapping[ c ] >= 0 ? src.buffer[ iSrc + dst.channelMapping[ c ] ] :
					dst.channelValues[ c ] ;
			}
		}
	}
} ;



/*
	Perform a blit, but the source pixel is an index, that will be substituted by the relevant source palette .

	Same arguments than .blit(), plus:

	src:
		palette: an array of array of values
*/
PortableImage.indexedBlit = function( src , dst ) {
	var blitWidth = Math.min( dst.endX - dst.x , ( src.endX - src.x ) * dst.scaleX ) ,
		blitHeight = Math.min( dst.endY - dst.y , ( src.endY - src.y ) * dst.scaleY ) ,
		channels = dst.channelMapping.length ;

	for ( let yOffset = 0 ; yOffset < blitHeight ; yOffset ++ ) {
		for ( let xOffset = 0 ; xOffset < blitWidth ; xOffset ++ ) {
			let iDst = ( ( dst.y + yOffset ) * dst.width + ( dst.x + xOffset ) ) * dst.bytesPerPixel ;
			let iSrc = ( Math.floor( src.y + yOffset / dst.scaleY ) * src.width + Math.floor( src.x + xOffset / dst.scaleX ) ) * src.bytesPerPixel ;
			let channelValues = src.palette[ src.buffer[ iSrc ] ] ;

			for ( let c = 0 ; c < channels ; c ++ ) {
				dst.buffer[ iDst + c ] =
					dst.channelMapping[ c ] >= 0 ? channelValues[ dst.channelMapping[ c ] ] :
					dst.channelValues[ c ] ;
			}
		}
	}
} ;



PortableImage.prototype.updateFromImageData = function( imageData , mapping ) {
	if ( ! mapping ) {
		if ( this.isRGBACompatible ) { mapping = PortableImage.RGBA_MAPPING ; }
		else if ( this.isRGBCompatible ) { mapping = PortableImage.RGB_MAPPING ; }
		else { throw new Error( "Mapping required for image that are not RGB/RGBA compatible" ) ; }
	}

	if ( imageData.width !== this.width || imageData.height !== this.height ) {
		throw new Error( ".updateFromImageData(): width and/or height mismatch" ) ;
	}
	
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iDst = i * this.bytesPerPixel ;
		let iSrc = i * 4 ;

		if ( this.indexed ) {
			let channelValues = [] ;
			channelValues[ iDst + mapping[ 0 ] ] = imageData[ iSrc ] ;
			channelValues[ iDst + mapping[ 1 ] ] = imageData[ iSrc + 1 ] ;
			channelValues[ iDst + mapping[ 2 ] ] = imageData[ iSrc + 2 ] ;
			channelValues[ iDst + mapping[ 3 ] ] = imageData[ iSrc + 3 ] ;

			this.pixelBuffer[ iDst ] = this.getClosestPaletteIndex( channelValues ) ;
		}

		this.pixelBuffer[ iDst + mapping[ 0 ] ] = imageData[ iSrc ] ;
		this.pixelBuffer[ iDst + mapping[ 1 ] ] = imageData[ iSrc + 1 ] ;
		this.pixelBuffer[ iDst + mapping[ 2 ] ] = imageData[ iSrc + 2 ] ;
		this.pixelBuffer[ iDst + mapping[ 3 ] ] = imageData[ iSrc + 3 ] ;
	}
} ;

