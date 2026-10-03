<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { addToCart, CartError, formatMoney, t } from '@pelagojs/shopify'
import { useCartOpen, useLocale } from '@pelagojs/vue'

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
}>()

const root = useTemplateRef('root')
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

// The island sits inside the section's Liquid product form, next to the dynamic checkout buttons
// ({{ form | payment_button }}), which read the variant and quantity from the form's id and quantity fields.
// Handling the form's submit, rather than a click on the button, also catches Enter in the quantity field.
let form: HTMLFormElement | null = null

onMounted(() => {
  form = root.value?.closest('form') ?? null
  form?.addEventListener('submit', onSubmit)
})
onUnmounted(() => form?.removeEventListener('submit', onSubmit))

function onSubmit(event: SubmitEvent): void {
  event.preventDefault()
  void add()
}

async function add(): Promise<void> {
  if (!variant.value || adding.value) return
  adding.value = true
  error.value = ''
  try {
    await addToCart({ id: variant.value.id, quantity: quantity.value })
    cartOpen.value = true
  } catch (e) {
    console.error('[product-form]', e)
    error.value = (e instanceof CartError && e.description) || t('cart.error')
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div ref="root" class="product-form__island">
    <input v-if="variant" type="hidden" name="id" :value="variant.id" />

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
      {{ t('product.quantity') }}
      <input v-model.number="quantity" type="number" name="quantity" min="1" required />
    </label>

    <button type="submit" :disabled="!variant?.available || adding" :aria-busy="adding">
      {{
        !variant
          ? t('product.unavailable')
          : variant.available
            ? t('product.add_to_cart')
            : t('product.sold_out')
      }}
    </button>

    <p v-if="error" class="product-form__error" role="alert">{{ error }}</p>
  </div>
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
