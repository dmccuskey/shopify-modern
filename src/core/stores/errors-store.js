/*
	Errors store

	main recipient of Errors data from Shopify
*/

// Libs
import Vue from 'vue'


export const ErrorsStore = Vue.extend( {

	data: function() {
		return {
			is_error: false,
			type: ''
		}
	},


	methods: {

		setData( data ) {
			if (!data) return
			for ( let prop in data ) {
				this[prop] = data[ prop ]
			}
		},

	}

})
