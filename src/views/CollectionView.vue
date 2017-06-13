/*
	Collections component shown for Collections/All
*/

<template>
	<div>
		<h1 class="red">{{ data.title }}</h1>
		<div class="rte" v-if="data.description!==''">{{ data.description }}</div>
		<product-grid-tile v-for="item in data.products" :key="item.id" :item="item"></product-grid-tile>
	</div>

</template>


<script>
	// Components
	import { Collections } from '../core/app-data'
	import ProductGridTile from '../components/ProductGridTile'

	export default {

		components: {
			ProductGridTile
		},

		data () {
			return {
				data: Collections
			}
		}
	}
</script>


<style>
	.red {
		color: #f00;
	}
</style>
