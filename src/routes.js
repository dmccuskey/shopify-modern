/*
	template routes

	match generic page routes or add custom versions
*/

// Components
import BlogView from './views/BlogView.vue'
import BlogPostView from './views/BlogPostView.vue'
import HomeView from './views/HomeView.vue'
import CollectionView from './views/CollectionView.vue'
import PageView from './views/PageView.vue'
import ProductDetailView from './views/ProductDetailView.vue'


export const routes = [
	{ path: '', component: HomeView },
	{ path: '/blogs/:name', component: BlogView },
	{ path: '/blogs/:name/:slug', component: BlogPostView },
	{ path: '/collections/all', component: CollectionView },
	{ path: '/collections/frontpage/products/:slug', component: ProductDetailView },
	{ path: '/products/:slug', component: ProductDetailView },

	// include custom page routes here
	// { path: '/pages/custom-page', component: CustomPageView },
	{ path: '/pages/:slug', component: PageView },
]
