/*
	Product component

	shown at route '/products/:slug'
*/

<template>
	<div>
		<h1 class="red">Product Page : {{ slug }}</h1>
		<div>{{ data.vendor }}</div>
		<div>{{ data.type }}</div>
		<div>{{ data.title }}</div>
	</div>

</template>

<script>
	// Components
	import { Products } from '../core/app-data'

	export default {

		data () {
			return {
				slug: this.$route.params.slug,
				data: Products
			}
		},

		// computed: {
		// 	data() {
		// 		return Products.getProduct( slug )
		// 	}
		// },

		watch: {
			'$route'( to, from ) {
				this.slug = to.params.slug
			}
		}
	}
</script>

<style>
	.red {
		color: #f00;
	}
</style>
