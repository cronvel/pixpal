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

	var pixPal = await PixPal.loadPng( 'tiny.png' , { crc32: true } ) ;
	//var pixPal = await PixPal.loadPng( 'crappy.png' , { crc32: true } ) ;
	//var pixPal = await PixPal.loadPng( 'out.png' , { crc32: true } ) ;
	console.log( pixPal ) ;

	//ctx.fillStyle = "green"; ctx.fillRect(0, 0, 100, 100);

	var imageData = pixPal.createImageData() ;
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

	var scaleRate = 30 ;
	//var scaleRate = 1 ;

	setInterval( async () => {
		let imageBitmap = await createImageBitmap( imageData ) ;

		colorRotationIndex = ( colorRotationIndex + 1 ) % colorRotation.length ;
		pixPal.setColor( 2 , colorRotation[ colorRotationIndex ] ) ;
		pixPal.updateImageData( imageData ) ;

		ctx.fillStyle = "green"; ctx.fillRect(0, 0, $canvas.width, $canvas.height);
		ctx.save() ;
		ctx.scale( scaleRate , scaleRate ) ;
		
		// .putImageData() doesn't support scaling, it is supposed to be raw data access to a canvas
		//ctx.putImageData( imageData , 0 , 0 ) ;

		// .drawImage() support scaling, but don't support ImageData, it should be an ImageBitmap
		ctx.imageSmoothingEnabled = false ;		// For pixel art, this is mandatory if we don't want the pixels to be blurred away
		ctx.drawImage( imageBitmap , 0 , 0 ) ;

		ctx.restore() ;
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

	var imageData = portableImage.createImageData( { scale: 10 } ) ;
	ctx.putImageData( imageData , 0 , 0 ) ;
}


// Like jQuery's $(document).ready()
const ready = callback => {
    document.addEventListener( 'DOMContentLoaded' , function internalCallback() {
        document.removeEventListener( 'DOMContentLoaded' , internalCallback , false ) ;
        callback() ;
    } , false ) ;
} ;



ready( test2 ) ;

