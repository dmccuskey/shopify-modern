/*
	Header component
*/


<template>
	<div>
		<form action="/search" method="get" role="search">
		<label for="Search" class="label-hidden">
			{{ i18n.placeholder }}
		</label>
		<input type="search"
					name="q"
					id="Search"
					:value="search_terms"
					:placeholder="i18n.placeholder">
		<button type="submit" class="btn">
			<span class="icon-fallback-text">{{ i18n.submit }}</span>
		</button>
		</form>

		<nav role="navigation">
			<ul class="site-nav">
				<li v-for="link in linklists" :class="{ 'site-nav--active': link.active }">
					<a :href="link.url" class="site-nav__link">{{ link.title }}</a>
				</li>
			</ul>
		</nav>

	</div>
</template>


<script>
	// Components
	import i18n from '../services/i18n'


	export default {
		data () {
			return {
				i18n: i18n.general.search,
				search_terms: '',
				// TODO: get this from Shopify data object
				linklists: [
					{
						title: 'Title',
						active: true,
						url: 'http://apple.com'
					},
					{
						title: 'About Us',
						active: false,
						url: 'http://nike.com'
					},
				]
			}
		}
	}
</script>


<style>
</style>
