<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../engine/types'
import CardView from './CardView.vue'

const props = defineProps<{
  player: Player
  position: 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight'
  revealCards?: boolean
  isTurn?: boolean
}>()

const statusLabel = computed(() => {
  if (props.player.status === 'fold') return '弃牌'
  if (props.player.status === 'allin') return '全下'
  return '在局'
})
</script>

<template>
  <section class="seat" :class="[position, { turn: !!isTurn }]">
    <header class="meta">
      <div class="name">
        <span class="dot" aria-hidden="true"></span>
        <span class="who">{{ player.name }}</span>
        <span class="badge" :data-kind="player.status">{{ statusLabel }}</span>
      </div>
      <div class="stack">
        <span class="k">筹码</span>
        <span class="v">{{ player.chips }}</span>
      </div>
    </header>

    <div class="cards">
      <CardView
        v-for="(c, i) in player.holeCards"
        :key="i"
        :card="c"
        :faceDown="!revealCards && position !== 'bottom'"
        :dim="player.status !== 'active'"
      />
    </div>

    <div class="bet" v-if="player.bet > 0">
      <span class="chip" aria-hidden="true"></span>
      <span class="amt">{{ player.bet }}</span>
    </div>
  </section>
</template>

<style scoped>
.seat {
  position: relative;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(10, 12, 16, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}

.seat.turn {
  border-color: rgba(226, 184, 90, 0.55);
  box-shadow: 0 0 0 1px rgba(226, 184, 90, 0.25), 0 22px 60px rgba(0, 0, 0, 0.35);
}

.meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.name {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 99px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.1)),
    linear-gradient(180deg, rgba(71, 255, 199, 0.6), rgba(71, 255, 199, 0.05));
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.who {
  font-weight: 650;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.06);
}

.badge[data-kind='fold'] {
  border-color: rgba(255, 255, 255, 0.08);
  opacity: 0.75;
}

.badge[data-kind='allin'] {
  border-color: rgba(255, 129, 171, 0.45);
  background: rgba(255, 129, 171, 0.12);
}

.stack {
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
  color: rgba(255, 255, 255, 0.78);
}

.stack .k {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.stack .v {
  font-weight: 700;
  color: rgba(226, 184, 90, 0.95);
}

.cards {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  justify-content: center;
}

.bet {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  gap: 10px;
  align-items: center;
  color: rgba(255, 255, 255, 0.85);
}

.chip {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.2)),
    linear-gradient(180deg, rgba(226, 184, 90, 0.9), rgba(226, 184, 90, 0.15));
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.amt {
  font-weight: 700;
}
</style>

