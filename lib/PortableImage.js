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
		channels: the channels, default to [ 'red' , 'green' , 'blue' , 'alpha' ] or PortableImage.RGBA
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

	this.isRgbCompatible = this.channels.length >= 3 && this.channels[ 0 ] === 'red' && this.channels[ 1 ] === 'green' && this.channels[ 2 ] === 'blue' ;
	this.isRgbaCompatible = this.channels.length >= 4 && this.isRgbCompatible && this.channels[ 3 ] === 'alpha' ;
	this.isRgb = this.isRgbCompatible && this.channels.length === 3 ;
	this.isRgba = this.isRgbaCompatible && this.channels.length === 4 ;

	this.isGrayCompatible = this.channels.length >= 1 && this.channels[ 0 ] === 'gray' ;
	this.isGrayAlphaCompatible = this.channels.length >= 2 && this.isGrayCompatible && this.channels[ 1 ] === 'alpha' ;
	this.isGray = this.isGrayCompatible && this.channels.length === 1 ;
	this.isGrayAlpha = this.isGrayAlphaCompatible && this.channels.length === 2 ;
}

module.exports = PortableImage ;



const Mapping = PortableImage.Mapping = require( './Mapping.js' ) ;
PortableImage.Mapping = Mapping ;
PortableImage.DirectChannelMapping = Mapping.DirectChannelMapping ;
PortableImage.DirectChannelMappingWithDefault = Mapping.DirectChannelMappingWithDefault ;
PortableImage.MatrixChannelMapping = Mapping.MatrixChannelMapping ;



PortableImage.RGB = [ 'red' , 'green' , 'blue' ] ;
PortableImage.RGBA = [ 'red' , 'green' , 'blue' , 'alpha' ] ;
PortableImage.GRAY = [ 'gray' ] ;
PortableImage.GRAY_ALPHA = [ 'gray' , 'alpha' ] ;



PortableImage.prototype.setPalette = function( palette ) {
	if ( ! this.indexed ) { throw new Error( "This is not an indexed image" ) ; }

	this.palette.length = 0 ;

	for ( let index = 0 ; index < palette.length ; index ++ ) {
		this.setPaletteEntry( index , palette[ index ] ) ;
	}
} ;



PortableImage.prototype.setPaletteEntry = function( index , entry ) {
	if ( this.isRgb || this.isRgba ) { return this.setPaletteColor( index , entry ) ; }

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
		if ( this.isRgba ) { currentColor[ 3 ] = color[ 3 ] ?? 255 ; }
	}
	else if ( typeof color === 'object' ) {
		currentColor[ 0 ] = color.R ?? color.r ?? 0 ;
		currentColor[ 1 ] = color.G ?? color.g ?? 0 ;
		currentColor[ 2 ] = color.B ?? color.b ?? 0 ;
		if ( this.isRgba ) { currentColor[ 3 ] = color.A ?? color.a ?? 255 ; }
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
			if ( this.isRgba ) { currentColor[ 3 ] = 255 ; }
		}
		else if ( color.length === 8 ) {
			currentColor[ 0 ] = ( code >> 24 ) & LESSER_BYTE_MASK ;
			currentColor[ 1 ] = ( code >> 16 ) & LESSER_BYTE_MASK ;
			currentColor[ 2 ] = ( code >> 8 ) & LESSER_BYTE_MASK ;
			if ( this.isRgba ) { currentColor[ 3 ] = code & LESSER_BYTE_MASK ; }
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



/*
	Copy to another PortableImage instance.
*/
PortableImage.prototype.copyTo = function( portableImage , mapping = null ) {
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
		mapping: mapping || this.getMappingTo( portableImage )
	} ;
	//console.log( "### Mapping: " , dst.mapping ) ;

	if ( this.indexed ) {
		src.palette = this.palette ;
		PortableImage.indexedBlit( src , dst ) ;
	}
	else {
		PortableImage.blit( src , dst ) ;
	}
} ;



/*
	Mapping is an array of twice the number of the channels, pairs of values :
	* the first value of the pair is the channel fixed value, it's null if the second of the pair should be used instead
	* the second value of the pair is the source channel index, it's null if the first of the pair should be used instead
*/

PortableImage.DEFAULT_CHANNEL_VALUES = {
	red: 0 ,
	green: 0 ,
	blue: 0 ,
	alpha: 255
} ;

// Create the mapping to another PortableImage
PortableImage.prototype.getMappingTo = function( toPortableImage , defaultChannelValues = PortableImage.DEFAULT_CHANNEL_VALUES ) {
	return this.getMappingToChannels( toPortableImage.channels , defaultChannelValues ) ;
} ;

PortableImage.prototype.getMappingToChannels = function( toChannels , defaultChannelValues = PortableImage.DEFAULT_CHANNEL_VALUES ) {
	var matrix = new Array( toChannels.length * 2 ) ;

	for ( let index = 0 ; index < toChannels.length ; index ++ ) {
		let channel = toChannels[ index ] ;

		if ( Object.hasOwn( this.channelIndex , channel ) ) {
			matrix[ index * 2 ] = this.channelIndex[ channel ] ;
			matrix[ index * 2 + 1 ] = null ;
		}
		else {
			matrix[ index * 2 ] = null ;
			matrix[ index * 2 + 1 ] = defaultChannelValues[ channel ] ?? 0 ;
		}
	}

	return new DirectChannelMappingWithDefault( matrix ) ;
} ;

PortableImage.getMapping = function( fromChannels , toChannels , defaultChannelValues = PortableImage.DEFAULT_CHANNEL_VALUES ) {
	var matrix = new Array( toChannels.length * 2 ) ;

	for ( let index = 0 ; index < toChannels.length ; index ++ ) {
		let channel = toChannels[ index ] ;
		let indexOf = fromChannels.indexOf( channel ) ;

		if ( indexOf >= 0 ) {
			matrix[ index * 2 ] = indexOf ;
			matrix[ index * 2 + 1 ] = null ;
		}
		else {
			matrix[ index * 2 ] = null ;
			matrix[ index * 2 + 1 ] = defaultChannelValues[ channel ] ?? 0 ;
		}
	}

	return new DirectChannelMappingWithDefault( matrix ) ;
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
		if ( imageData.width === this.width && imageData.height === this.height ) {
			if ( this.indexed ) {
				if ( this.isRgbaCompatible ) { return this.isoIndexedRgbaCompatibleToRgbaBlit( imageData.data ) ; }
				if ( this.isRgbCompatible ) { return this.isoIndexedRgbCompatibleToRgbaBlit( imageData.data ) ; }
			}
			else {
				if ( this.isRgbaCompatible ) { return this.isoRgbaCompatibleToRgbaBlit( imageData.data ) ; }
				if ( this.isRgbCompatible ) { return this.isoRgbCompatibleToRgbaBlit( imageData.data ) ; }
			}
		}

		if ( this.isRgbaCompatible ) { mapping = Mapping.RGBA_COMPATIBLE_TO_RGBA ; }
		else if ( this.isRgbCompatible ) { mapping = Mapping.RGB_COMPATIBLE_TO_RGBA ; }
		else if ( this.isGrayAlphaCompatible ) { mapping = Mapping.GRAY_ALPHA_COMPATIBLE_TO_RGBA ; }
		else if ( this.isGrayCompatible ) { mapping = Mapping.GRAY_COMPATIBLE_TO_RGBA ; }
		else { throw new Error( "Mapping required for image that are not RGB/RGBA/Grayscale/Grayscale+Alpha compatible" ) ; }
	}

	//console.warn( "Mapping:" , mapping ) ;

	let src = {
		buffer: this.pixelBuffer ,
		width: this.width ,
		height: this.height ,
		bytesPerPixel: this.bytesPerPixel ,
		x: 0 ,
		y: 0 ,
		endX: this.width ,
		endY: this.height ,
		channels: this.channels.length
	} ;

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
		channels: 4 ,
		mapping
	} ;

	if ( this.indexed ) {
		src.palette = this.palette ;
		PortableImage.indexedBlit( src , dst ) ;
	}
	else {
		PortableImage.blit( src , dst ) ;
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
		* mapping: the mapping of the channel from src to dst, it is an array of twice the number of the channels, pairs of values :
			* the first value of the pair is the channel fixed value, it's null if the second of the pair should be used instead
			* the second value of the pair is the source channel index, it's null if the first of the pair should be used instead
*/
PortableImage.blit = function( src , dst ) {
	//console.warn( ".blit() used" , src , dst ) ;
	var blitWidth = Math.min( dst.endX - dst.x , ( src.endX - src.x ) * dst.scaleX ) ,
		blitHeight = Math.min( dst.endY - dst.y , ( src.endY - src.y ) * dst.scaleY ) ,
		channels = Math.floor( dst.mapping.length / 2 ) ;

	for ( let yOffset = 0 ; yOffset < blitHeight ; yOffset ++ ) {
		for ( let xOffset = 0 ; xOffset < blitWidth ; xOffset ++ ) {
			let iDst = ( ( dst.y + yOffset ) * dst.width + ( dst.x + xOffset ) ) * dst.bytesPerPixel ;
			let iSrc = ( Math.floor( src.y + yOffset / dst.scaleY ) * src.width + Math.floor( src.x + xOffset / dst.scaleX ) ) * src.bytesPerPixel ;
			dst.mapping.map( src , dst , iSrc , iDst ) ;
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
	//console.warn( ".indexedBlit() used" , src , dst ) ;
	var blitWidth = Math.min( dst.endX - dst.x , ( src.endX - src.x ) * dst.scaleX ) ,
		blitHeight = Math.min( dst.endY - dst.y , ( src.endY - src.y ) * dst.scaleY ) ,
		channels = Math.floor( dst.mapping.length / 2 ) ;

	for ( let yOffset = 0 ; yOffset < blitHeight ; yOffset ++ ) {
		for ( let xOffset = 0 ; xOffset < blitWidth ; xOffset ++ ) {
			let iDst = ( ( dst.y + yOffset ) * dst.width + ( dst.x + xOffset ) ) * dst.bytesPerPixel ;
			let iSrc = ( Math.floor( src.y + yOffset / dst.scaleY ) * src.width + Math.floor( src.x + xOffset / dst.scaleX ) ) * src.bytesPerPixel ;
			let channelValues = src.palette[ src.buffer[ iSrc ] ] ;
			dst.mapping.map( src , dst , 0 , iDst , channelValues ) ;
		}
	}
} ;



// Optimized Blit for RGB-compatible to RGBA
PortableImage.prototype.isoRgbCompatibleToRgbaBlit = function( dst ) {
	//console.warn( ".isoRgbCompatibleToRgbaBlit() used" , dst ) ;
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDst = i * 4 ;

		dst[ iDst ] = this.pixelBuffer[ iSrc ] ;			// Red
		dst[ iDst + 1 ] = this.pixelBuffer[ iSrc + 1 ] ;	// Green
		dst[ iDst + 2 ] = this.pixelBuffer[ iSrc + 2 ] ;	// Blue
		dst[ iDst + 3 ] = 255 ;	// Alpha
	}
} ;



// Optimized Blit for RGBA-compatible to RGBA
PortableImage.prototype.isoRgbaCompatibleToRgbaBlit = function( dst ) {
	//console.warn( ".isoRgbaCompatibleToRgbaBlit() used" , dst , this ) ;
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDst = i * 4 ;

		dst[ iDst ] = this.pixelBuffer[ iSrc ] ;			// Red
		dst[ iDst + 1 ] = this.pixelBuffer[ iSrc + 1 ] ;	// Green
		dst[ iDst + 2 ] = this.pixelBuffer[ iSrc + 2 ] ;	// Blue
		dst[ iDst + 3 ] = this.pixelBuffer[ iSrc + 3 ] ;	// Alpha
	}
} ;



// Optimized Blit for Indexed RGB-compatible to RGBA
PortableImage.prototype.isoIndexedRgbCompatibleToRgbaBlit = function( dst ) {
	//console.warn( ".isoIndexedRgbCompatibleToRgbaBlit() used" , dst ) ;
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDst = i * 4 ;
		let paletteEntry = this.palette[ this.pixelBuffer[ iSrc ] ] ;

		dst[ iDst ] = paletteEntry[ 0 ] ;		// Red
		dst[ iDst + 1 ] = paletteEntry[ 1 ] ;	// Green
		dst[ iDst + 2 ] = paletteEntry[ 2 ] ;	// Blue
		dst[ iDst + 3 ] = 255 ;	// Alpha
	}
} ;



// Optimized Blit for Indexed RGBA-compatible to RGBA
PortableImage.prototype.isoIndexedRgbaCompatibleToRgbaBlit = function( dst ) {
	//console.warn( ".isoIndexedRgbaCompatibleToRgbaBlit() used" , dst ) ;
	for ( let i = 0 , imax = this.width * this.height ; i < imax ; i ++ ) {
		let iSrc = i * this.bytesPerPixel ;
		let iDst = i * 4 ;
		let paletteEntry = this.palette[ this.pixelBuffer[ iSrc ] ] ;

		dst[ iDst ] = paletteEntry[ 0 ] ;		// Red
		dst[ iDst + 1 ] = paletteEntry[ 1 ] ;	// Green
		dst[ iDst + 2 ] = paletteEntry[ 2 ] ;	// Blue
		dst[ iDst + 3 ] = paletteEntry[ 3 ] ;	// Alpha
	}
} ;



PortableImage.prototype.updateFromImageData = function( imageData , mapping ) {
	throw new Error( "Not coded!" ) ;

	// /!\ TODO /!\

	if ( ! mapping ) {
		if ( this.isRgbaCompatible ) { mapping = Mapping.RGBA_COMPATIBLE_TO_RGBA ; }
		else if ( this.isRgbCompatible ) { mapping = Mapping.RGB_COMPATIBLE_TO_RGBA ; }
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

