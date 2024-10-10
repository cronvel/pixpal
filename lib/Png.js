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



const crc32 = require( 'crc-32' ) ;


// Includes depending on the environment
var DecompressionStream = null ;
var getFileAsync = null ;

if ( process.browser ) {
	DecompressionStream = window.DecompressionStream ;
	getFileAsync = async ( url ) => {
		var response = await fetch( 'tiny.png' ) ;
		if ( ! response.ok ) {
			throw new Error( "Can't retrieve file: '" + url + "', " + response.status + " - " + response.statusText ) ;
		}
		var bytes = await response.bytes() ;
		var buffer = Buffer.from( bytes ) ;
		return buffer ;
	} ;
}
else {
	let require_ = require ;	// this is used to fool Browserfify, so it doesn't try include this in the build
	DecompressionStream = require_( 'stream/web' ).DecompressionStream ;
	let fs = require_( 'fs' ) ;
	getFileAsync = url => fs.promises.readFile( url ) ;
}



function Png() {
	// IHDR
	this.width = -1 ;
	this.height = -1 ;
	this.bitDepth = -1 ;
	this.colorType = -1 ;
	this.compressionMethod = -1 ;
	this.filterMethod = -1 ;
	this.interlaceMethod = -1 ;

	// PLTE and tRNS
	this.palette = [] ;

	// bKGD
	this.backgroundColorIndex = -1 ;

	// IDAT
	this.idatBuffers = [] ;

	// Final
	this.bitsPerPixel = -1 ;
	this.decodedBytesPerPixel = -1 ;
	this.imageData = null ;
}

module.exports = Png ;



Png.COLOR_TYPE_GRAYSCALE = 0 ;
Png.COLOR_TYPE_RGB = 2 ;
Png.COLOR_TYPE_INDEXED = 3 ;
Png.COLOR_TYPE_GRAYSCALE_ALPHA = 4 ;
Png.COLOR_TYPE_RGBA = 6 ;



Png.load = async function( url , options = {} ) {
	var buffer = await getFileAsync( url ) ;
	return Png.decode( buffer , options ) ;
} ;



Png.decode = async function( buffer , options = {} ) {
	var png = new Png() ;
	await png.decode( buffer , options ) ;
	return png ;
} ;



// A PNG file always starts with this bytes
const PNG_MAGIC_NUMBERS = [ 0x89 , 0x50 , 0x4E , 0x47 , 0x0D , 0x0A , 0x1A , 0x0A ] ;

// Sadly it should be async, because browser's Compression API works with streams
Png.prototype.decode = async function( buffer , options = {} ) {
	var offset = 0 ;

	// Magic numbers
	for ( ; offset < PNG_MAGIC_NUMBERS.length ; offset ++ ) {
		if ( buffer[ offset ] !== PNG_MAGIC_NUMBERS[ offset ] ) {
			throw new Error( "Not a PNG, it doesn't start with PNG magic numbers" ) ;
		}
	}
	
	this.palette.length = 0 ;
	this.imageData = null ;

	// Chunk reading
	while ( offset < buffer.length ) {
		let chunkSize = buffer.readUInt32BE( offset ) ;
		let chunkType = buffer.toString( 'latin1' , offset + 4 , offset + 8 ) ;
		let chunkCrc32 = buffer.readInt32BE( offset + 8 + chunkSize ) ;
		
		console.log( "Found chunk: '" + chunkType + "' of size: " + chunkSize + " and CRC-32: " + chunkCrc32 ) ;
		
		if ( chunkDecoders[ chunkType ] ) {
			// Node.js buffer.slice() create a view, be careful because TypedArray.slice() create a copy!

			if ( options.crc32 ) {
				let chunkComputedCrc32 = crc32.buf( buffer.slice( offset + 4 , offset + 8 + chunkSize ) , 0 ) ;
				if ( chunkComputedCrc32 !== chunkCrc32 ) {
					throw new Error( "Bad CRC-32 for chunk '" + chunkType + "', expecting: " + chunkCrc32 + " but got: " + chunkComputedCrc32  ) ;
				}
			}
			
			chunkDecoders[ chunkType ].call( this , buffer.slice( offset + 8 , offset + 8 + chunkSize ) , options ) ;
		}

		offset += chunkSize + 12 ;
	}
	
	await this.generateImageData() ;
} ;



const chunkDecoders = {} ;

chunkDecoders.IHDR = function( buffer , options ) {
	let offset = 0 ;

	this.width = buffer.readUInt32BE( offset ) ; offset += 4 ;
	this.height = buffer.readUInt32BE( offset ) ; offset += 4 ;
	this.bitDepth = buffer.readUInt8( offset ) ; offset ++ ;
	this.colorType = buffer.readUInt8( offset ) ; offset ++ ;
	this.compressionMethod = buffer.readUInt8( offset ) ; offset ++ ;
	this.filterMethod = buffer.readUInt8( offset ) ; offset ++ ;
	this.interlaceMethod = buffer.readUInt8( offset ) ; offset ++ ;
	
	this.computeBitsPerPixel() ;

	console.log( "After IHDR:" , this ) ;
} ;



chunkDecoders.PLTE = function( buffer , options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for PLTE: " + this.colorType ) ;
	}

	this.palette.length = 0 ;

	for ( let index = 0 , offset = 0 ; offset < buffer.length ; index ++ , offset += 3 ) {
		this.palette[ index ] = [
			buffer.readUInt8( offset ) ,
			buffer.readUInt8( offset + 1 ) ,
			buffer.readUInt8( offset + 2 ) ,
			255
		] ;
	}

	console.log( "PLTE:" , this.palette ) ;
} ;



chunkDecoders.tRNS = function( buffer , options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for tRNS: " + this.colorType ) ;
	}

	for ( let index = 0 , imax = Math.min( this.palette.length , buffer.length ) ; index < imax ; index ++ ) {
		this.palette[ index ][ 3 ] = buffer.readUInt8( index ) ;
	}

	console.log( "tRNS:" , this.palette ) ;
} ;



chunkDecoders.bKGD = function( buffer , options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for bKGD: " + this.colorType ) ;
	}

	this.backgroundColorIndex = buffer.readUInt8( 0 ) ;

	console.log( "bKGD:" , this.backgroundColorIndex ) ;
} ;



chunkDecoders.IDAT = function( buffer , options ) {
	this.idatBuffers.push( buffer ) ;
	console.log( "Raw IDAT:" , buffer , buffer.length ) ;
} ;



Png.prototype.generateImageData = async function() {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for IDAT: " + this.colorType ) ;
	}

	if ( this.interlaceMethod ) {
		throw new Error( "Interlace methods are unsupported (IDAT): " + this.interlaceMethod ) ;
	}

	this.imageData = new Uint8ClampedArray( this.width * this.height * this.decodedBytesPerPixel ) ;

	var compressedBuffer = Buffer.concat( this.idatBuffers ) ;
	var buffer = await deflate( compressedBuffer ) ;
	console.log( "Decompressed IDAT:" , buffer , buffer.length ) ;
	
	var lineByteLength = 1 + Math.ceil( this.width * this.bitsPerPixel / 8 ) ;
	var exepectedBufferLength = lineByteLength * this.height ;
	var imageDataLineByteLength = this.width * this.decodedBytesPerPixel ;

	if ( exepectedBufferLength !== buffer.length ) {
		throw new Error( "Expecting a decompressed buffer of length of " + exepectedBufferLength + " but got: " + buffer.length ) ;
	}

	console.log( "lineByteLength:" , lineByteLength ) ;
	for ( let y = 0 ; y < this.height ; y ++ ) {
		this.decodeLineFilter( buffer , y * lineByteLength , ( y + 1 ) * lineByteLength , y > 0 ? ( y - 1 ) * lineByteLength : -1 ) ;
		this.extractLine( buffer , y * lineByteLength + 1 , y * imageDataLineByteLength ) ;
	}

	console.log( "imageData:" , this.imageData , this.imageData.length ) ;
} ;



Png.prototype.decodeLineFilter = function( buffer , start , end , lastLineStart ) {
	var filterType = buffer[ start ] ;
	if ( filterType === 0 ) { return ; }	// filter 0 doesn't change anything
	console.log( "Watch out! FilterType is not 0!" ) ;
	
	var bytesPerPixel = Math.ceil( this.bitsPerPixels / 8 ) ;
	
	for ( let i = 0 , imax = end - start ; i < imax ; i ++ ) {
		/*
			We use the same byte names than in the PNG spec (https://www.w3.org/TR/png-3/#9Filter-types):
			
			c b			c: previous byte of the same color channel of the line before		b: byte of the previous line
			a x			a: previous byte of the same color channel							x: current byte
		*/

		let x = buffer[ start + i ] ,
			a = i > 0 ? buffer[ start + i - bytesPerPixel ] : 0 ,
			b = lastLineStart >= 0 ? buffer[ lastLineStart + i ] : 0 ,
			c = i > 0 && lastLineStart >= 0 ? buffer[ lastLineStart + i - bytesPerPixel ] : 0 ;

		// We modify in-place, it is possible and desirable since a, b and c requires the reconstructed bytes
		buffer[ start + i ] = filters[ filterType ]( x , a , b , c ) ;
	}
} ;



/*
	Filters details here: https://www.w3.org/TR/png-3/#9Filter-types
	For encode(): x, a, b, c are the original byte value.
	For decode(): x is the filtered (encoded) byte value, while a, b, c are the reconstructed byte value.
*/
const filters = [] ;

filters[ 0 ] = {
	encode: ( x , a , b , c ) => x ,
	decode: ( x , a , b , c ) => x
} ;

filters[ 1 ] = {
	encode: ( x , a , b , c ) => x - a ,
	decode: ( x , a , b , c ) => x + a
} ;

filters[ 2 ] = {
	encode: ( x , a , b , c ) => x - b ,
	decode: ( x , a , b , c ) => x + b
} ;

filters[ 3 ] = {
	encode: ( x , a , b , c ) => x - Math.floor( ( a + b ) / 2 ) ,
	decode: ( x , a , b , c ) => x + Math.floor( ( a + b ) / 2 )
} ;

filters[ 4 ] = {
	encode: ( x , a , b , c ) => x - paethPredictor( a , b , c ) ,
	decode: ( x , a , b , c ) => x + paethPredictor( a , b , c )
} ;

// A no-brainer port of the pseudo-code for PaethPredictor directly from the PNG spec, see here: https://www.w3.org/TR/png-3/#9Filter-types
function paethPredictor( a , b , c ) {
	var pr ,
		p = a + b - c ,
		pa = Math.abs( p - a ) ,
		pb = Math.abs( p - b ) ,
		pc = Math.abs( p - c ) ;

	if ( pa <= pb && pa <= pc ) { pr = a ; }
	else if ( pb <= pc ) { pr = b ; }
	else { pr = c ; }
	
	return pr ;
} ;



Png.prototype.extractLine = function( buffer , start , imageDataStart ) {
	if ( this.bitsPerPixel >= 8 ) { this.extractLineFromBytes( buffer , start , imageDataStart ) ; }
	else { this.extractLineFromBits( buffer , start , imageDataStart ) ; }
} ;



Png.prototype.extractLineFromBytes = function( buffer , start , imageDataStart ) {
	for ( let i = 0 , imax = this.width * this.decodedBytesPerPixel ; i < imax ; i ++ ) {
		this.imageData[ imageDataStart + i ] = buffer[ start + i ] ;
	}
} ;



Png.prototype.extractLineFromBits = function( buffer , start , imageDataStart ) {
	var byteRate = this.bitsPerPixel / 8 ;

	for ( let x = 0 ; x < this.width ; x ++ ) {
		let byteOffset = Math.floor( x * byteRate ) ;
		let bitOffset = ( x * this.bitsPerPixel ) % 8 ;
		this.imageData[ imageDataStart + x ] = extractBits( buffer[ start + byteOffset ] , bitOffset , this.bitsPerPixel ) ;
	}
} ;



const COUNT_BIT_MASK = [
	0 ,
	0b1 ,
	0b11 ,
	0b111 ,
	0b1111 ,
	0b11111 ,
	0b111111 ,
	0b1111111 ,
	0b11111111 ,
] ;

const extractBits = ( byte , offset , count ) => ( byte >> ( 8 - offset - count ) ) & COUNT_BIT_MASK[ count ] ;



Png.prototype.computeBitsPerPixel = function() {
	switch ( this.colorType ) {
		case Png.COLOR_TYPE_GRAYSCALE :
		case Png.COLOR_TYPE_INDEXED :
			this.bitsPerPixel = this.bitDepth ;
			break ;
		case Png.COLOR_TYPE_RGB :
			this.bitsPerPixel = this.bitDepth * 3 ;
			break ;
		case Png.COLOR_TYPE_GRAYSCALE_ALPHA :
			this.bitsPerPixel = this.bitDepth * 2 ;
			break ;
		case Png.COLOR_TYPE_RGBA :
			this.bitsPerPixel = this.bitDepth * 4 ;
			break ;
	}
	
	this.decodedBytesPerPixel = Math.ceil( this.bitsPerPixel / 8 ) ;
} ;



async function deflate( buffer ) {
	//console.log( "Buffer:" , buffer , buffer.length ) ;
	const decompressionStream = new DecompressionStream( 'deflate' ) ;
	const blob = new Blob( [ buffer ] ) ;
	//console.log( "Blob:" , blob , blob.size ) ;
	const stream = blob.stream().pipeThrough( decompressionStream ) ;
	//var stream = blob.stream() ;
	//console.log( "Blob bytes:" , await blob.arrayBuffer() ) ;

	const chunks = [] ;
	let totalLength = 0 ;

	for await ( let chunk of stream ) {
		//console.log( "Chunk:" , chunk ) ;
		chunks.push( chunk ) ;
		totalLength += chunk.length ;
	}
	
	const outputBuffer = Buffer.allocUnsafe( totalLength ) ;

	let offset = 0 ;
	for ( let chunk of chunks ) {
		for ( let byte of chunk ) {
			outputBuffer[ offset ++ ] = byte ;
		}
	}
	
	//console.log( "Output:" , outputBuffer ) ;
	return outputBuffer ;
}

