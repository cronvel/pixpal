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

PixPal.loadPng( sourceFile , { crc32: true } ) ;

