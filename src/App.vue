/*
	main application Vue component
*/

<template>
	<div>
		<app-header />
		<router-view></router-view>
	</div>

</template>


<script>
	// Components
	import Header from './components/Header'

	export default {

		components: {
			AppHeader : Header
		},

		data () {
			return {
			}
		}
	}
</script>


<style>
	.red {
		color: #f00;
	}
</style>
