<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addToCart, CartError, formatMoney } from '@shopify-modern/shopify'
import { useCartOpen, useLocale } from '@shopify-modern/vue'

interface Variant {
  id: number
  title: string
  /** in cents */
  price: number
  available: boolean
  /** the variant's value for each of the product's options, in order */
  options: string[]
}

const props = defineProps<{
  product: {
    /** the option names, such as `Color` */
    options: string[]
    variants: Variant[]
    hasOnlyDefaultVariant: boolean
  }
  selectedVariantId: number
  strings: {
    addToCart: string
    soldOut: string
    unavailable: string
    quantity: string
    error: string
  }
}>()

const locale = useLocale()
const cartOpen = useCartOpen()

const initial =
  props.product.variants.find((v) => v.id === props.selectedVariantId) ?? props.product.variants[0]
const selected = ref<string[]>([...(initial?.options ?? [])])
const quantity = ref(1)
const adding = ref(false)
const error = ref('')

// the values offered for each option, in the order the variants list them
const optionValues = computed(() =>
  props.product.options.map((_, i) => [
    ...new Set(props.product.variants.map((v) => v.options[i] ?? '')),
  ]),
)
const variant = computed(() =>
  props.product.variants.find((v) => v.options.every((value, i) => value === selected.value[i])),
)
const price = computed(() =>
  variant.value ? formatMoney(variant.value.price, locale.value.moneyFormat) : '',
)

// keep ?variant= in the address bar, as a Liquid product page does, so a reload or a shared link keeps the choice
watch(variant, (v) => {
  error.value = ''
  if (!v) return
  const url = new URL(location.href)
  url.searchParams.set('variant', String(v.id))
  history.replaceState(history.state, '', url)
})

async function add(): Promise<void> {
  if (!variant.value) return
  adding.value = true
  error.value = ''
  try {
    await addToCart({ id: variant.value.id, quantity: quantity.value })
    cartOpen.value = true
  } catch (e) {
    console.error('[product-form]', e)
    error.value = (e instanceof CartError && e.description) || props.strings.error
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <form class="product-form__island" @submit.prevent="add">
    <template v-if="!product.hasOnlyDefaultVariant">
      <label v-for="(name, i) in product.options" :key="name">
        {{ name }}
        <select v-model="selected[i]">
          <option v-for="value in optionValues[i]" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
    </template>

    <p class="product-form__price">{{ price }}</p>

    <label>
      {{ strings.quantity }}
      <input v-model.number="quantity" type="number" min="1" required />
    </label>

    <button type="submit" :disabled="!variant?.available || adding" :aria-busy="adding">
      {{ !variant ? strings.unavailable : variant.available ? strings.addToCart : strings.soldOut }}
    </button>

    <p v-if="error" class="product-form__error" role="alert">{{ error }}</p>
  </form>
</template>

<style>
.product-form__island {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}
.product-form__island label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.product-form__island input[type='number'] {
  width: 5rem;
}
.product-form__error {
  color: #b00020;
}
</style>
