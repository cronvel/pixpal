#!/usr/bin/env node

"use strict" ;

const PixPal = require( '..' ) ;
//const fs = require( 'fs' ) ;



// Argument management

if ( process.argv.length < 3 ) {
	console.error( "Expecting a PNG file" ) ;
	process.exit( 1 ) ;
}

var sourceFile = process.argv[ 2 ] ;
var outputFile = process.argv[ 3 ] ?? null ;


async function test() {
	var image = await PixPal.Png.loadImage( sourceFile , { crc32: true } ) ;

	if ( outputFile ) {
		await PixPal.Png.saveImage( outputFile , image ) ;
	}
}

test() ;

