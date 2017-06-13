# shopify-modern

This proof-of-concept shows a method of creating an ecommerce experience for Shopify by using modern front-end development tools and techniques, while still leveraging some of the beneficial features of the Shopify system & infrastructure.


## Overview

Shopify's Wordpress-like structure is as much fun to work with as Wordpress – "let's develop like it's 1999!" :-) These days we know that it can be done better.

This project shows a working, hybrid Shopify-template which still runs on the Shopify infrastructure. However, because of a very clear separation between Shopify and the front-end, we can develop the web experience using modern tools.

While this project template is NOT full-SPA, it helps by giving a roadmap for those wanting to transform an existing Shopify template into one which is both modern and full-SPA. The project already has features to help with that goal in mind.



## Benefits

Here are some of the benefits of this framework / concept:

**Framework**

* Modern development with Vuejs
* Internationalization (i18n)
* Special tags & filters (like in Shopify Liquid)
* Clear separation between Shopify Liquid & Vuejs code & markup
* Rendered page components determined using Vuejs routes paired with Shopify URLs.
* Avoid any potential issues with [Shopify 64k page-limit](https://help.shopify.com/manual/using-themes/troubleshooting/fix-64-kilobyte-limit-errors)
* Search-bot friendly (soon)

**Shopify**

* Hosting / Scalability handled by Shopify
* SEO friendly
* Server-Side-Augmentation (ie, lightweight Server Side Rendering)
* Settings / Config files still useful

**Future**

* Clear path to full-SPA
* Ability to do *local* development !


## How it works

One of the main benefits is that the framework can serialize many of the [Shopify data-objects](https://help.shopify.com/themes/liquid/objects). This serialized data can either be embedded in the primary HTML page or loaded later using HTTP requests. The corresponding front-end Vuejs objects can initialize themselves with either method.

Though this doesn't qualify as full server-side rendering, having embedded data speeds up the initial page draw since the information will not need to be loaded by subsequent AJAX requests.

In the future, there will be more control over which data is embedded and which is lazy-loaded after the first page render.

### Steps to Template-Freedom

If you want to start integrating the ideas into an existing project, your main goal is to move almost all of the site information out of the Liquid templates. Two important steps for that would be:

1. insert app anchors into HTML

	Depending on how far along you are with the transition, you can use one or many anchors which will be under control of your framework (eg, Vuejs).

	```
		<!-- a single anchor for the entire app (like in this project) -->
		<div id="vueapp"></div>
	```

	```
		<!-- one of many anchors for individual components -->
		<div id="calendar-widget"></div>
		<div id="product-picker-widget"></div>
	```

1. integrate a normal build process

	use Webpack or Gulp to generate a typical build file, eg `dist/build.js`.

	*Do NOT include any of your front-end code in the Fluid templates*. All of it should be inside of `build.js`, and that file being sourced from `theme.liquid`.


## Setup

(rough notes!)

1. Install [Shopify Themekit](https://shopify.github.io/themekit/)
1. Rename `config-sample.yml` to `config.yml`. Add your password, theme id, store name.
1. Run `webpack` to re-pack code upon changes
1. Run `themekit` to upload webpack output to Shopify


## Libraries

This project uses these libraries:

* https://shopify.github.io/themekit/

	We use **themekit** to upload files, as opposed to [Slate](https://github.com/Shopify/slate), since **Slate** is geared towards traditional Shopify theme development. ([Quickshot](https://quickshot.readme.io) seems like a good choice, too.)


## Inspiration

Inspiration for this project came from the following:

* https://www.shopify.com/partners/blog/28500611-using-javascript-to-super-power-your-clients-shopify-site
* https://github.com/tshamz/shopify-frankenstein


## References

* https://stackoverflow.com/questions/43505094/using-vue-js-in-shopify-liquid-templates

	As a side benefit of using this structure, any issues with delimiter conflicts are avoided.
