/*
	main application Vue component
*/

<template>
	<div>
		<app-header />

		<error-404-view v-if="Errors.is_error && Errors.type=='404'" />
		<router-view v-else></router-view>

	</div>
</template>


<script>
	// Components
	import Error404View from './views/Error404View'
	import Header from './components/Header'
	import { Errors } from './core/app-data'


	export default {

		components: {
			AppHeader : Header,
			Error404View
		},

		data () {
			return {
				Errors
			}
		}
	}
</script>


<style>
	.red {
		color: #f00;
	}
</style>
