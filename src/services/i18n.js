/*
	Internationalization service
*/

// Libs
import Vue from 'vue'

// languages
// import additional languages here, register below
import LangEn from '../locales/en-default'


/*
	look inside of the data structure to determine the top-level properties
*/
function createDataStructure( data ) {
	const result = {}
	for (let key in data) {
		if (data.hasOwnProperty(key)) {
			result[ key ] = null
		}
	}
	return result
}


const LocaleService = Vue.extend( {

	data: function() {
		const { data } = LangEn
		const struct = {
			_lang:{},
			_current: ""
		}
		return Object.assign( struct, createDataStructure( data ) )
	},


	methods: {

		register( language ) {
			const { is_default } = language.info

			const key = this._createKey( language )
			this.$data._lang[ key ] = language

			if ( is_default==true ) this._setCurrentLang( language )
		},

		_createKey( language ) {
			const { lang, locale } = language.info
			return [ lang, locale ].join('-')
		},

		_setCurrentLang( language ) {
			const { data } = language

			const key = this._createKey( language )
			this.$data._current = key

			for ( let prop in data ) {
				this[ prop ] = data[ prop ]
			}
		}

	}

})


const service = new LocaleService()

// register additional language files
service.register( LangEn )


export default service