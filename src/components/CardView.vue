<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../engine/types'
import { rankToChar, suitToChar } from '../engine/cards'

const props = defineProps<{
  card?: Card
  faceDown?: boolean
  dim?: boolean
}>()

const label = computed(() => {
  if (!props.card) return ''
  return `${rankToChar(props.card.rank)}${suitToChar(props.card.suit)}`
})

const isRed = computed(() => props.card?.suit === 'H' || props.card?.suit === 'D')
</script>

<template>
  <div class="card" :class="{ down: !!faceDown, dim: !!dim, red: isRed }" aria-hidden="true">
    <div class="card-inner">
      <div class="pip tl" v-if="!faceDown && card">{{ label }}</div>
      <div class="pip br" v-if="!faceDown && card">{{ label }}</div>
      <div class="back" v-if="faceDown"></div>
      <div class="face" v-else>
        <div class="center" v-if="card">{{ suitToChar(card.suit) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  width: 74px;
  height: 104px;
  border-radius: 14px;
  position: relative;
  transform: translateZ(0);
  filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.36));
}

.card.dim {
  opacity: 0.6;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.26));
}

.card-inner {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(0, 0, 0, 0.22);
  position: relative;
}

.card.down .card-inner {
  background: radial-gradient(120px 80px at 30% 30%, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 55%),
    linear-gradient(135deg, rgba(10, 12, 18, 0.95), rgba(36, 26, 52, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.pip {
  font-weight: 650;
  letter-spacing: -0.04em;
  font-size: 14px;
  position: absolute;
  color: rgba(17, 24, 39, 0.92);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}

.card.red .pip {
  color: rgba(155, 25, 56, 0.92);
}

.tl {
  top: 10px;
  left: 10px;
}

.br {
  bottom: 10px;
  right: 10px;
  transform: rotate(180deg);
}

.back {
  position: absolute;
  inset: 0;
  background: radial-gradient(200px 140px at 50% 50%, rgba(196, 140, 255, 0.14), rgba(0, 0, 0, 0) 56%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08) 0 6px, rgba(255, 255, 255, 0.02) 6px 12px);
  opacity: 0.9;
}

.face {
  position: absolute;
  inset: 0;
}

.center {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 34px;
  color: rgba(17, 24, 39, 0.26);
}

.card.red .center {
  color: rgba(155, 25, 56, 0.22);
}
</style>

