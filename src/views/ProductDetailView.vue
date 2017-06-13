/*
	Product component

	shown at route '/products/:slug'
*/

<template>
	<div>
		<h1 class="red">Product Page : {{ slug }}</h1>
	</div>

</template>

<script>
	export default {

		data () {
			return {
				slug: this.$route.params.slug
			}
		},

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
