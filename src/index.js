/*
	file to bootstrap Vuejs
*/

// Libs
import Vue from 'vue'
import VueRouter from 'vue-router'

// Components
import App from './App.vue'
import { routes } from './routes'


// Setup

Vue.use( VueRouter )
Vue.filter( 'money', function(value) {
	return (value/100).toFixed(2)
})

const router = new VueRouter({
	routes,
	mode: 'history',
})

new Vue({
	el: '#vueapp',
	router,
	render: function ( createElement ) {
		return createElement( App )
	}
})
