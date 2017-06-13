/*
	Variant model

	object to help retrieve Variant information from Product data
*/

// Libs
import Vue from 'vue'


export const Variant = Vue.extend( {

	data: function() {
		return {
			available: false,
			barcode: "",
			compare_at_price_max: 0,
			featured_image: "",
			id: 0,
			inventory_management: null,
			inventory_policy: "deny",
			inventory_quantity: 1,
			name: "",
			option1: "",
			option2: "",
			option3: "",
			options: [], //
			price: 0,
			public_title: "",
			requires_shipping: true,
			sku: "",
			taxable: true,
			title: "",
			weight: 0,
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
