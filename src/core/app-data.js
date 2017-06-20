/*
	App Data service

	this module processes all of the json data from Shopify
*/

// Components
import { CollectionsStore } from './stores/collections-store'
import { ErrorsStore } from './stores/errors-store'
import { ProductsStore } from './stores/products-store'



// Support functions

const WARN_MISSING_DATA_NODE = "No HTML data-node found"
const WARN_NO_NODE_DATA = "Node data is empty"

function getHtmlData( key ) {
	const node = document.getElementById( key )
	if ( !node ) return Promise.reject( WARN_MISSING_DATA_NODE )
	return Promise.resolve( node.innerHTML )
}

function processHtmlData( data ) {
	if ( data=="" )
		return Promise.reject( WARN_NO_NODE_DATA )
	else {
		try {
			return Promise.resolve( JSON.parse( data ) )
		} catch( e ) {
			return Promise.reject( e )
		}
	}
}

function setJsonDataOnInstance( instance ) {
	return function( json ) {
		instance.setData( json )
	}
}


// initialize Data Stores


const COLLECTIONS_DATA_ID = 'collections-data'
const Collections = new CollectionsStore();  // need the semi here

(function( key, instance ) {

	const setJsonData = setJsonDataOnInstance( instance )

	getHtmlData( key )
		.then( processHtmlData )
		.then( setJsonData )
		.catch( err => console.warn( `WARNING while loading '${key}':`, err ) )

})( COLLECTIONS_DATA_ID, Collections )


const ERRORS_DATA_ID = 'errors-data'
const Errors = new ErrorsStore();  // need the semi here

(function( key, instance ) {

	const setJsonData = setJsonDataOnInstance( instance )

	getHtmlData( key )
		.then( processHtmlData )
		.then( setJsonData )
		.catch( err => console.warn( `WARNING while loading '${key}':`, err ) )

})( ERRORS_DATA_ID, Errors )


const PRODUCTS_DATA_ID = 'products-data'
const Products = new ProductsStore();  // need the semi here

(function( key, instance ) {

	const setJsonData = setJsonDataOnInstance( instance )

	getHtmlData( key )
		.then( processHtmlData )
		.then( setJsonData )
		.catch( err => console.warn( `WARNING while loading '${key}':`, err ) )

})( PRODUCTS_DATA_ID, Products )



export { Collections, Errors, Products }
