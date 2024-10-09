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



function Png() {
}

module.exports = Png ;



// A PNG file always starts with this bytes
const PNG_MAGIC_NUMBERS = [ 0x89 , 0x50 , 0x4E , 0x47 , 0x0D , 0x0A , 0x1A , 0x0A ] ;

Png.decode = function( buffer , options = {} ) {
	var offset = 0 ;

	// Magic numbers
	for ( ; offset < PNG_MAGIC_NUMBERS.length ; offset ++ ) {
		if ( buffer[ offset ] !== PNG_MAGIC_NUMBERS[ offset ] ) {
			throw new Error( "Not a PNG, it doesn't start with PNG magic numbers" ) ;
		}
	}
	
	// Chunk reading
	while ( offset < buffer.length ) {
		let chunkSize = buffer.readUint32BE( offset ) ;
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
			
			chunkDecoders[ chunkType ]( buffer.slice( offset + 8 , offset + 8 + chunkSize )  , options ) ;
		}

		offset += chunkSize + 12 ;
	}
} ;



const chunkDecoders = {} ;

chunkDecoders.IHDR = function( buffer , options ) {
	let offset = 0 ;

	let width = buffer.readUint32BE( offset ) ; offset += 4 ;
	let height = buffer.readUint32BE( offset ) ; offset += 4 ;
	let bitDepth = buffer.readUint8( offset ) ; offset ++ ;
	let colorType = buffer.readUint8( offset ) ; offset ++ ;
	let compressionMethod = buffer.readUint8( offset ) ; offset ++ ;
	let filterMethod = buffer.readUint8( offset ) ; offset ++ ;
	let interlaceMethod = buffer.readUint8( offset ) ; offset ++ ;

	let data = { width , height , bitDepth , colorType , compressionMethod , filterMethod , interlaceMethod } ;
	console.log( "IHDR:" , data ) ;
	return data ;
} ;



