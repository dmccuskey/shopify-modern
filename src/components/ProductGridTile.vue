/*

*/

<template>
	<div>
		<a :href="item.url">
			<img :src="item.featured_image" alt="">
		</a>

		<a :href="item.url">
		<h3 class="dark">{{ item.title }}</h3>
		</a>

		<template v-if="item.compare_at_price > item.price">
			<span>$ {{item.compare_at_price | money }}</span>
			<span>$ {{item.price | money }} on sale !</span>
		</template>
		<template v-else>
			<span>$ {{item.price | money }}</span>
		</template>

		<span v-if="item.available==false">{{ i18n.sold_out }}</span>

	</div>

</template>


<script>
	// Components
	import i18n from '../services/i18n'


	export default {
		props: ['item'],
		data () {
			return {
				i18n: i18n.products.product
			}
		}
	}

</script>


<style>
	.red {
		color: #f00;
	}
	.dark {
		color: #333;
	}
</style>
