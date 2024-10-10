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
	if ( outputFile ) {
		let png = await PixPal.Png.load( sourceFile , { crc32: true } ) ;
		
		// TMP: force bitDepth
		png.bitDepth = 8 ;
		
		console.log( "\n\n### SAVING!" , png ) ;
		png.save( outputFile ) ;
	}
	else {
		await PixPal.loadPng( sourceFile , { crc32: true } ) ;
	}
}

test() ;

