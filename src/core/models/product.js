/*
	Product model

	object to help retrieve Product information from Collections data
*/

// Libs
import Vue from 'vue'

// Components
import { Variant } from '../models/variant'


export const Product = Vue.extend( {

	data: function() {
		return {
			available: false,
			compare_at_price: null,
			compare_at_price_max: 0,
			compare_at_price_min: 0,
			compare_at_price_varies: false,
			content: "",
			created_at: "",  // ISO date string
			description: "",
			featured_image: "",
			handle: "", // 'i-love-unicorn'
			id: 0,
			images: [],
			options: [],
			price: 0,
			price_max: 0,
			price_min: 0,
			price_varies: false,
			published_at: "",  // ISO date string
			tags: [],
			title: "",
			type: "",
			_variants: {},
			vendor: "",
		}
	},


	computed: {

		variants: {
			get: function() {
				console.log("product variants", this.$data._variants )
				return this.$data._variants
			},
			set: function( list ) {
				for (let idx=0, len=list.length; idx < len; idx++) {
					let d = list[ idx ]
					let id = d.id
					let o = this.$data._variants[ id ]
					if ( o==undefined ) {
						o = new Variant()
						this.$data._variants[ id ] = o
					}
					o.setData( d )
				}
			}
		},

		url() {
			return `/products/${this.handle}`
		}

	},


	methods: {

		setData( data ) {
			if (!data) return
			for ( let prop in data ) {
				this[ prop ] = data[ prop ]
			}
		},

	}

})
