/*
	Collection store

	main recipient of Collections data from Shopify
*/

// Libs
import Vue from 'vue'

// Components
import { Product } from '../models/product'


export const CollectionsStore = Vue.extend( {

	data: function() {
		return {
			title: '',
			_products: {}
		}
	},


	computed: {

		products: {
			get: function() {
				return this.$data._products
			},
			set: function( list ) {
				const products = this.$data._products
				for (let idx=0, len=list.length; idx < len; idx++) {
					let d = list[ idx ]
					let id = d.id
					let o = products[ id ]
					if ( o==undefined ) {
						o = new Product()
						this.$set( products, id, o )
					}
					o.setData( d )
				}
			}
		},

	},


	methods: {

		setData( data ) {
			if (!data) return
			for ( let prop in data ) {
				const value = data[ prop ]
				if ( ['products', 'title'].indexOf( prop )!==-1 ) {
					this[prop] = data[ prop ]
				}
			}
		},

	}

})
