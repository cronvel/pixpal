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
var CompressionStream = null ;
var loadFileAsync = null ;
var saveFileAsync = null ;

if ( process.browser ) {
	DecompressionStream = window.DecompressionStream ;
	CompressionStream = window.CompressionStream ;
	loadFileAsync = async ( url ) => {
		var response = await fetch( 'tiny.png' ) ;
		if ( ! response.ok ) {
			throw new Error( "Can't retrieve file: '" + url + "', " + response.status + " - " + response.statusText ) ;
		}
		var bytes = await response.bytes() ;
		var buffer = Buffer.from( bytes ) ;
		return buffer ;
	} ;
	saveFileAsync = () => { throw new Error( "Can't save from the web" ) ; } ;
}
else {
	let require_ = require ;	// this is used to fool Browserfify, so it doesn't try include this in the build
	( { DecompressionStream , CompressionStream } = require_( 'stream/web' ) ) ;
	let fs = require_( 'fs' ) ;
	loadFileAsync = url => fs.promises.readFile( url ) ;
	saveFileAsync = ( url , data ) => fs.promises.writeFile( url , data ) ;
}



function Png() {
	// IHDR
	this.width = - 1 ;
	this.height = - 1 ;
	this.bitDepth = - 1 ;
	this.colorType = - 1 ;
	this.compressionMethod = - 1 ;
	this.filterMethod = - 1 ;
	this.interlaceMethod = - 1 ;

	// PLTE and tRNS
	this.palette = [] ;

	// bKGD
	this.backgroundColorIndex = - 1 ;

	// IDAT
	this.idatBuffers = [] ;

	// IEND
	this.iendReceived = false ;

	// Final
	this.bitsPerPixel = - 1 ;
	this.decodedBytesPerPixel = - 1 ;
	this.imageData = null ;
}

module.exports = Png ;



// PNG constants

Png.COLOR_TYPE_GRAYSCALE = 0 ;
Png.COLOR_TYPE_RGB = 2 ;
Png.COLOR_TYPE_INDEXED = 3 ;
Png.COLOR_TYPE_GRAYSCALE_ALPHA = 4 ;
Png.COLOR_TYPE_RGBA = 6 ;



// Chunk/Buffer constants

const CHUNK_META_SIZE = 12 ;
// A PNG file always starts with this bytes
const PNG_MAGIC_NUMBERS = [ 0x89 , 0x50 , 0x4E , 0x47 , 0x0D , 0x0A , 0x1A , 0x0A ] ;
const PNG_MAGIC_NUMBERS_BUFFER = Buffer.from( PNG_MAGIC_NUMBERS ) ;
const IEND_CHUNK = [	// Instead of triggering the whole chunk machinery, just put this pre-computed IEND chunk
	0x00 , 0x00 , 0x00 , 0x00 ,		// Zero-length
    0x49 , 0x45 , 0x4e , 0x44 ,		// IEND
    0xae , 0x42 , 0x60 , 0x82		// CRC-32 of IEND
] ;
const IEND_CHUNK_BUFFER = Buffer.from( IEND_CHUNK ) ;



Png.load = async function( url , options = {} ) {
	var buffer = await loadFileAsync( url ) ;
	return Png.decode( buffer , options ) ;
} ;



Png.decode = async function( buffer , options = {} ) {
	var png = new Png() ;
	await png.decode( buffer , options ) ;
	return png ;
} ;



Png.prototype.save = async function( url , options = {} ) {
	var buffer = await this.encode( options ) ;
	await saveFileAsync( url , buffer ) ;
} ;



Png.prototype.encode = async function( options = {} ) {
	var chunks = [] ;

	// Add magic numbers
	chunks.push( PNG_MAGIC_NUMBERS_BUFFER ) ;

	// IHDR: image header
	await this.addChunk( chunks , 'IHDR' , options ) ;

	// PLTE: the palette for indexed PNG
	await this.addChunk( chunks , 'PLTE' , options ) ;

	// tRNS: the color indexes for transparency
	await this.addChunk( chunks , 'tRNS' , options ) ;

	// bKGD: the default background color
	await this.addChunk( chunks , 'bKGD' , options ) ;

	// IDAT: the image pixel data
	await this.addChunk( chunks , 'IDAT' , options ) ;

	// Finalize by sending the IEND chunk to end the file
	chunks.push( IEND_CHUNK_BUFFER ) ;

	console.log( "Chunks:" , chunks ) ;
	return Buffer.concat( chunks ) ;
} ;



Png.prototype.addChunk = async function( chunks , chunkType , options ) {
	if ( ! chunkEncoders[ chunkType ] ) { return ; }

	var dataBuffer = await chunkEncoders[ chunkType ].call( this , options ) ;
	console.log( "dataBuffer:" , chunkType , dataBuffer ) ;
	if ( ! dataBuffer ) { return ; }

	var chunkBuffer = this.generateChunkFromData( chunkType , dataBuffer ) ;
	chunks.push( chunkBuffer ) ;
} ;



Png.prototype.generateChunkFromData = function( chunkType , dataBuffer ) {
	// 4 bytes for the data length | 4 bytes type (ascii) | chunk data (variable length) | 4 bytes of CRC-32 (type + data)
	var chunkBuffer = Buffer.alloc( CHUNK_META_SIZE + dataBuffer.length ) ;

	chunkBuffer.writeInt32BE( dataBuffer.length ) ;
	chunkBuffer.write( chunkType , 4 , 4 , 'latin1' ) ;
	dataBuffer.copy( chunkBuffer , 8 ) ;

	// Add the CRC-32, the 2nd argument of crc32.buf() is the seed, it's like building a CRC
	// of a single buffer containing chunkType + dataBuffer.
	var chunkComputedCrc32 = crc32.buf( dataBuffer , crc32.bstr( chunkType ) ) ;
	chunkBuffer.writeInt32BE( chunkComputedCrc32 , chunkBuffer.length - 4 ) ;
	console.log( "Generated chunk: '" + chunkType + "' of size: " + dataBuffer.length + " and CRC-32: " + chunkComputedCrc32 ) ;

	return chunkBuffer ;
} ;



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
		if ( this.iendReceived ) {
			throw new Error( "Bad PNG, chunk after IEND" ) ;
		}

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
	
	if ( ! this.iendReceived ) {
		throw new Error( "Bad PNG, no IEND chunk received" ) ;
	}

	await this.generateImageData() ;
} ;



const chunkDecoders = {} ;
const chunkEncoders = {} ;

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



chunkEncoders.IHDR = function( options ) {
	let buffer = Buffer.allocUnsafe( 13 ) ;
	let offset = 0 ;

	buffer.writeUInt32BE( this.width , offset ) ; offset += 4 ;
	buffer.writeUInt32BE( this.height , offset ) ; offset += 4 ;
	buffer.writeUInt8( this.bitDepth , offset ) ; offset ++ ;
	buffer.writeUInt8( this.colorType , offset ) ; offset ++ ;
	buffer.writeUInt8( this.compressionMethod , offset ) ; offset ++ ;
	buffer.writeUInt8( this.filterMethod , offset ) ; offset ++ ;
	buffer.writeUInt8( this.interlaceMethod , offset ) ; offset ++ ;

	return buffer ;
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



chunkEncoders.PLTE = function( options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) { return ; }
	//if ( ! this.palette.length ) { return ; }

	let buffer = Buffer.allocUnsafe( this.palette.length * 3 ) ;

	for ( let index = 0 , offset = 0 ; index < this.palette.length ; index ++ , offset += 3 ) {
		let color = this.palette[ index ] ;
		buffer.writeUInt8( color[ 0 ] , offset ) ;
		buffer.writeUInt8( color[ 1 ] , offset + 1 ) ;
		buffer.writeUInt8( color[ 2 ] , offset + 2 ) ;
	}

	return buffer ;
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



chunkEncoders.tRNS = function( options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED || ! this.palette.length ) { return ; }

	let transparentIndexes = [] ;

	for ( let colorIndex = 0 ; colorIndex < this.palette.length ; colorIndex ++ ) {
		if ( this.palette[ colorIndex ][ 3 ] < 128 ) { transparentIndexes.push( colorIndex ) ; }
	}

	if ( ! transparentIndexes.length ) { return ; }

	return Buffer.from( transparentIndexes ) ;
} ;



chunkDecoders.bKGD = function( buffer , options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for bKGD: " + this.colorType ) ;
	}

	this.backgroundColorIndex = buffer.readUInt8( 0 ) ;

	console.log( "bKGD:" , this.backgroundColorIndex ) ;
} ;



chunkEncoders.bKGD = function( options ) {
	if ( this.colorType !== Png.COLOR_TYPE_INDEXED || this.backgroundColorIndex < 0 ) { return ; }

	let buffer = Buffer.allocUnsafe( 1 ) ;
	buffer.writeUInt8( this.backgroundColorIndex , 0 ) ;
	return buffer ;
} ;



chunkDecoders.IDAT = function( buffer , options ) {
	this.idatBuffers.push( buffer ) ;
	console.log( "Raw IDAT:" , buffer , buffer.length ) ;
} ;



chunkEncoders.IDAT = async function( options ) {
	if ( ! this.imageData ) { return ; }

	if ( this.colorType !== Png.COLOR_TYPE_INDEXED ) {
		throw new Error( "Unsupported color type for IDAT: " + this.colorType ) ;
	}

	if ( this.bitDepth !== 8 ) {
		throw new Error( "Unsupported bitDepth type for IDAT encoder: " + this.bitDepth ) ;
	}

	if ( this.interlaceMethod ) {
		throw new Error( "Interlace methods are unsupported (IDAT): " + this.interlaceMethod ) ;
	}

	var lineByteLength = this.width + 1 ;
	var idatBuffer = Buffer.allocUnsafe( lineByteLength * this.height ) ;

	// Prepare the PNG buffer, using only filter 0 and no Adam7, we just want it to work
	for ( let y = 0 ; y < this.height ; y ++ ) {
		let offset = y * lineByteLength ;

		// We don't care for filters ATM, it requires heuristic, it's boring to do...
		idatBuffer.writeUInt8( 0 , offset ) ;

		// Boring, Buffer has no .copyFrom(), and this.imageData is a UInt8ClampedArray...
		for ( let x = 0 ; x < this.width ; x ++ ) {
			idatBuffer.writeUInt8( this.imageData[ y * this.width + x ] , offset + 1 + x ) ;
		}
	}

	var compressedBuffer = await deflate( idatBuffer ) ;
	console.log( "Compressed IDAT:" , compressedBuffer , compressedBuffer.length ) ;

	return compressedBuffer ;
} ;



chunkDecoders.IEND = function( buffer , options ) {
	this.iendReceived = true ;
	console.log( "IEND" ) ;
} ;



chunkEncoders.IEND = function( options ) {
	return Buffer.allocUnsafe( 0 ) ;
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
	var buffer = await inflate( compressedBuffer ) ;
	console.log( "Decompressed IDAT:" , buffer , buffer.length ) ;

	var lineByteLength = 1 + Math.ceil( this.width * this.bitsPerPixel / 8 ) ;
	var expectedBufferLength = lineByteLength * this.height ;
	var imageDataLineByteLength = this.width * this.decodedBytesPerPixel ;

	if ( expectedBufferLength !== buffer.length ) {
		throw new Error( "Expecting a decompressed buffer of length of " + expectedBufferLength + " but got: " + buffer.length ) ;
	}

	console.log( "lineByteLength:" , lineByteLength ) ;
	for ( let y = 0 ; y < this.height ; y ++ ) {
		this.decodeLineFilter( buffer , y * lineByteLength , ( y + 1 ) * lineByteLength , y > 0 ? ( y - 1 ) * lineByteLength : - 1 ) ;
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
}



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
	0b11111111
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



async function inflate( buffer ) {
	const decompressionStream = new DecompressionStream( 'deflate' ) ;
	const blob = new Blob( [ buffer ] ) ;
	const stream = blob.stream().pipeThrough( decompressionStream ) ;
	//console.log( "Blob bytes:" , await blob.arrayBuffer() ) ;

	const chunks = [] ;
	for await ( let chunk of stream ) { chunks.push( chunk ) ; }

	// Buffer.concat() also accepts Uint8Array
	return Buffer.concat( chunks ) ;
}



async function deflate( buffer ) {
	const compressionStream = new CompressionStream( 'deflate' ) ;
	const blob = new Blob( [ buffer ] ) ;
	const stream = blob.stream().pipeThrough( compressionStream ) ;
	//console.log( "Blob bytes:" , await blob.arrayBuffer() ) ;

	const chunks = [] ;
	for await ( let chunk of stream ) { chunks.push( chunk ) ; }

	// Buffer.concat() also accepts Uint8Array
	return Buffer.concat( chunks ) ;
}

