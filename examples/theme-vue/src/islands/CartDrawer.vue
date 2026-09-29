<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { CartError, changeCart, formatMoney } from '@shopify-modern/shopify'
import { useCart, useCartOpen, useLocale } from '@shopify-modern/vue'

const props = defineProps<{
  cartUrl: string
  /** the theme's cart icon, inline SVG from `icon-cart.svg` */
  icon: string
  strings: {
    title: string
    empty: string
    close: string
    remove: string
    decrease: string
    increase: string
    subtotal: string
    checkout: string
    error: string
  }
}>()

const cart = useCart()
const open = useCartOpen()
const locale = useLocale()
const dialog = useTemplateRef('dialog')
const busy = ref<string | null>(null)
const error = ref('')

const count = computed(() => cart.value?.item_count ?? 0)
const money = (cents: number) => formatMoney(cents, locale.value.moneyFormat)

// a small image from Shopify's CDN, which resizes by the width parameter
function thumbnail(src: string): string {
  const url = new URL(src, location.href)
  url.searchParams.set('width', '160')
  return url.href
}

// the native dialog handles Escape, focus and the backdrop; $cartOpen follows it both ways
watch(open, (value) => {
  if (value && !dialog.value?.open) dialog.value?.showModal()
  if (!value && dialog.value?.open) dialog.value.close()
})

// Escape fires cancel at once, but Chrome can hold back close (in a hidden tab, until it renders),
// so cancel closes the drawer too, and a late close is ignored if the drawer has opened again
function onClose(): void {
  if (!dialog.value?.open) open.value = false
}

function onClick(event: MouseEvent): void {
  // a click on the backdrop reaches the dialog itself
  if (event.target === dialog.value) open.value = false
}

async function setQuantity(key: string, quantity: number): Promise<void> {
  busy.value = key
  error.value = ''
  try {
    await changeCart({ id: key, quantity })
  } catch (e) {
    console.error('[cart-drawer]', e)
    error.value = (e instanceof CartError && e.description) || props.strings.error
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <a :href="cartUrl" :aria-label="strings.title" @click.prevent="open = true">
    <sup v-if="count > 0">{{ count }}</sup>
    <!-- eslint-disable-next-line vue/no-v-html -- the theme's own SVG asset, not user content -->
    <span class="cart-drawer__icon" v-html="icon" />
  </a>

  <dialog
    ref="dialog"
    class="cart-drawer"
    :aria-label="strings.title"
    @cancel="open = false"
    @close="onClose"
    @click="onClick"
  >
    <div class="cart-drawer__header">
      <h2>{{ strings.title }}</h2>
      <button type="button" @click="open = false">{{ strings.close }}</button>
    </div>

    <p v-if="!cart?.items.length">{{ strings.empty }}</p>

    <ul v-else class="cart-drawer__items">
      <li v-for="item in cart.items" :key="item.key" :aria-busy="busy === item.key">
        <img v-if="item.image" :src="thumbnail(item.image)" alt="" width="80" height="80" />
        <div>
          <a :href="item.url">{{ item.product_title }}</a>
          <p v-if="item.variant_title">{{ item.variant_title }}</p>
          <p>{{ money(item.final_line_price) }}</p>
          <div class="cart-drawer__quantity">
            <button
              type="button"
              :disabled="!!busy"
              :aria-label="strings.decrease"
              @click="setQuantity(item.key, item.quantity - 1)"
            >
              −
            </button>
            <span>{{ item.quantity }}</span>
            <button
              type="button"
              :disabled="!!busy"
              :aria-label="strings.increase"
              @click="setQuantity(item.key, item.quantity + 1)"
            >
              +
            </button>
            <button type="button" :disabled="!!busy" @click="setQuantity(item.key, 0)">
              {{ strings.remove }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="error" class="cart-drawer__error" role="alert">{{ error }}</p>

    <form v-if="cart?.items.length" class="cart-drawer__footer" :action="cartUrl" method="post">
      <p>
        {{ strings.subtotal }}: <strong>{{ money(cart.total_price) }}</strong>
      </p>
      <button type="submit" name="checkout">{{ strings.checkout }}</button>
    </form>
  </dialog>
</template>

<style>
.cart-drawer__icon {
  display: flex;
}
.cart-drawer {
  margin: 0 0 0 auto;
  width: min(26rem, 100%);
  height: 100%;
  max-height: 100%;
  border: none;
  padding: 1.5rem;
  background: var(--color-background);
  color: var(--color-foreground);
}
.cart-drawer::backdrop {
  background: rgb(0 0 0 / 0.4);
}
.cart-drawer__header,
.cart-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.cart-drawer__items {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cart-drawer__items li {
  display: flex;
  gap: 1rem;
}
.cart-drawer__items li[aria-busy='true'] {
  opacity: 0.5;
}
.cart-drawer__items img {
  object-fit: cover;
}
.cart-drawer__quantity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cart-drawer__error {
  color: #b00020;
}
</style>
