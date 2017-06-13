var path = require('path')
var webpack = require('webpack')
var WebpackNotifierPlugin = require('webpack-notifier') // Mac notifications
var CopyWebpackPlugin = require('copy-webpack-plugin')


var base_config = {
	devtool: 'source-map',
	entry: {
		build: [
			'./src/index.js',
		],
	},
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'assets/[name].js',
		publicPath: '/dist/',
		pathinfo: true, // dev-only
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				loader: 'style-loader!css-loader'
			},
			{
				test: /\.vue$/,
				loader: 'vue-loader',
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'babel-loader',
			},
		],
	},
	plugins: [
		new webpack.ProvidePlugin({
			$: 'jquery',
			jQuery: 'jquery',
		}),
		new WebpackNotifierPlugin({ alwaysNotify: true }),
		new CopyWebpackPlugin([

			// Shopify Standard
			{ from: 'src/core/shopify/assets', to: 'assets' },
			{ from: 'src/core/shopify/config', to: 'config' },
			{ from: 'src/core/shopify/layout', to: 'layout' },
			{ from: 'src/core/shopify/locales', to: 'locales' },
			{ from: 'src/core/shopify/sections', to: 'sections' },
			{ from: 'src/core/shopify/snippets', to: 'snippets' },
			{ from: 'src/core/shopify/templates', to: 'templates' },

			// Shopify Modern
			{ from: 'src/core/modern/layout', to: 'layout' },
			{ from: 'src/core/modern/snippets', to: 'snippets' },
			{ from: 'src/core/modern/templates', to: 'templates' },
		])
	],
	resolve: {
		extensions: ['.js', '.vue'],
		modules: [
			path.join(__dirname, 'src'),
			'node_modules',
		],
		enforceExtension: false,
	},
	externals: {
	},
}


module.exports = base_config
