/*
	SVG Kit

	Copyright (c) 2017 - 2024 Cédric Ronvel

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



async function test() {
	var $canvas = document.getElementById( 'canvas' ) ;
	var ctx = $canvas.getContext( '2d' ) ;

	var portableImage = await PixPal.Png.loadImage( 'tiny.png' , { crc32: true } ) ;
	console.log( portableImage ) ;

	var imageDataParams = { scaleX: 20 , scaleY: 20 } ;
	var imageData = portableImage.createImageData( imageDataParams ) ;
	ctx.putImageData( imageData , 0 , 0 ) ;

	var colorRotationIndex = 0 ,
		colorRotation = [
			[255,0,0],
			[255,127,0],
			[255,255,0],
			[127,255,0],
			[0,255,0],
			[0,255,127],
			[0,255,255],
			[0,127,255],
			[0,0,255],
			[127,0,255],
			[255,0,255],
			[255,0,127],
			'#f00',
			'#ff0000',
			'#ff0000e0',
			'#ff0000c0',
			'#ff0000a0',
			'#ff000080',
			'#ff000060',
			'#ff000040',
			'#ff000020',
		] ;

	setInterval( async () => {
		let imageBitmap = await createImageBitmap( imageData ) ;

		colorRotationIndex = ( colorRotationIndex + 1 ) % colorRotation.length ;
		portableImage.setPaletteColor( 2 , colorRotation[ colorRotationIndex ] ) ;
		portableImage.updateImageData( imageData , imageDataParams ) ;
		ctx.putImageData( imageData , 0 , 0 ) ;
	} , 100 ) ;

	// Trigger a download
	//setTimeout( () => pixPal.downloadPng( 'my.png' ) , 1000 ) ;
}


async function test2() {
	var $canvas = document.getElementById( 'canvas' ) ;
	var ctx = $canvas.getContext( '2d' ) ;

	var portableImage = await PixPal.Png.loadImage( 'tiny.png' , { crc32: true } ) ;
	console.log( portableImage ) ;

	//ctx.fillStyle = "green"; ctx.fillRect(0, 0, 100, 100);

	var imageData = portableImage.createImageData( { scaleX: 10 , scaleY: 20 } ) ;
	ctx.putImageData( imageData , 0 , 0 ) ;
}


// Like jQuery's $(document).ready()
const ready = callback => {
    document.addEventListener( 'DOMContentLoaded' , function internalCallback() {
        document.removeEventListener( 'DOMContentLoaded' , internalCallback , false ) ;
        callback() ;
    } , false ) ;
} ;



ready( test ) ;

