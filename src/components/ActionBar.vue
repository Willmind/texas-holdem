<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type HandResult = {
  kind: 'fold' | 'showdown'
  winners: number[]
  perPlayer: { index: number; name: string; status: string; handName?: string; handDetail?: string; handBadges?: string[] }[]
  pots?: { amount: number; eligible: number[]; winners: number[]; share: number; remainder: number }[]
}

const props = defineProps<{
  canAct: boolean
  toCall: number
  minRaise: number
  maxRaiseTo: number
  stageLabel: string
  isYourTurn: boolean
  pot: number
  handResult?: HandResult | null
}>()

const emit = defineEmits<{
  (e: 'fold'): void
  (e: 'call'): void
  (e: 'raise', to: number): void
  (e: 'allin'): void
  (e: 'startHand'): void
  (e: 'reset'): void
}>()

const raiseTo = ref(0)
const showHandResult = ref(false)

watch(
  () => [props.minRaise, props.maxRaiseTo],
  () => {
    raiseTo.value = clamp(props.minRaise, props.minRaise, props.maxRaiseTo)
  },
  { immediate: true },
)

const callLabel = computed(() => (props.toCall === 0 ? '过牌' : `跟注 ${props.toCall}`))
const raiseDisabled = computed(() => !props.canAct || props.maxRaiseTo < props.minRaise)
const raisePretty = computed(() => (raiseDisabled.value ? '不可加注' : `加注到 ${raiseTo.value}`))

const handResultAvailable = computed(() => Boolean(props.handResult))
const handResultTitle = computed(() => {
  if (!props.handResult) return '本手结果'
  return props.handResult.kind === 'fold' ? '本手结果（弃牌结束）' : '本手结果（摊牌/边池）'
})

watch(
  () => props.handResult,
  (v, prev) => {
    // New hand starts (handResult cleared) -> close.
    if (!v) {
      showHandResult.value = false
      return
    }
    // Hand just ended (handResult created/changed) -> auto open.
    if (!prev || prev !== v) showHandResult.value = true
  },
)

function clamp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, Math.floor(v)))
}
</script>

<template>
  <aside class="bar">
    <header class="top">
      <div class="stage">
        <div class="title">当前街</div>
        <div class="value">{{ stageLabel }}</div>
      </div>
      <div class="pot">
        <div class="title">底池</div>
        <div class="value">{{ pot }}</div>
      </div>
    </header>

    <div class="turn" :data-on="isYourTurn">
      <span class="spark" aria-hidden="true"></span>
      <span class="t">{{ isYourTurn ? '轮到你行动' : '等待对手…' }}</span>
    </div>

    <div class="actions">
      <button type="button" class="btn-soft" @click="emit('fold')" :disabled="!canAct">弃牌</button>
      <button type="button" class="btn-mint" @click="emit('call')" :disabled="!canAct">{{ callLabel }}</button>
      <button type="button" class="btn-rose" @click="emit('allin')" :disabled="!canAct">全下</button>
    </div>

    <div class="raise">
      <div class="row">
        <div class="label">加注</div>
        <div class="value">{{ raisePretty }}</div>
      </div>
      <input
        class="slider"
        type="range"
        :min="minRaise"
        :max="maxRaiseTo"
        step="1"
        v-model.number="raiseTo"
        :disabled="raiseDisabled"
      />
      <button type="button" class="btn-gold btn-gold--rounded" @click="emit('raise', raiseTo)" :disabled="raiseDisabled">确认加注</button>
    </div>

    <div class="meta">
      <button type="button" class="btn-soft" @click="emit('startHand')">发下一手</button>
      <button type="button" class="btn-soft" @click="emit('reset')">重置</button>
    </div>

    <div class="meta">
      <button type="button" class="btn-soft" @click="showHandResult = true" :disabled="!handResultAvailable">本手结果</button>
    </div>

    <div class="handResultOverlay" v-if="showHandResult && handResultAvailable" role="dialog" aria-modal="true">
      <div class="handResultPanel">
        <div class="handResultHd">
          <div class="handResultTitle">{{ handResultTitle }}</div>
          <button type="button" class="btn-soft btn-soft--icon" @click="showHandResult = false" aria-label="关闭">×</button>
        </div>

        <div class="handResultGrid">
          <div class="handResultRow" v-for="p in handResult?.perPlayer ?? []" :key="p.index" :data-w="handResult?.winners.includes(p.index)">
            <div class="nm">{{ p.name }}</div>
            <div class="st">{{ p.status }}</div>
            <div class="hn">
              <span class="hn-main">{{ p.handName ?? '-' }}</span>
              <span class="hn-sub" v-if="p.handDetail">（{{ p.handDetail }}）</span>
              <span class="badges" v-if="p.handBadges && p.handBadges.length > 0">
                <span class="rankBadge" v-for="(b, i) in p.handBadges" :key="i">{{ b }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="handResultPots" v-if="handResult?.kind === 'showdown' && handResult?.pots">
          <div class="pt" v-for="(potItem, idx) in handResult.pots" :key="idx">
            <div class="pt-h">边池 {{ idx + 1 }} · {{ potItem.amount }}</div>
            <div class="pt-b">
              <div class="l">
                赢家：{{
                  potItem.winners
                    .map((i) => (handResult?.perPlayer ?? []).find((p) => p.index === i)?.name)
                    .filter((v): v is string => Boolean(v))
                    .join('、') || '—'
                }}
              </div>
              <div class="l">每人分到：{{ potItem.share }} <span v-if="potItem.remainder > 0">（余数 {{ potItem.remainder }}：按顺序各 +1）</span></div>
            </div>
          </div>
        </div>
      </div>
      <button class="handResultBackdrop" @click="showHandResult = false" aria-label="关闭背景"></button>
    </div>
  </aside>
</template>

<style scoped>
.bar {
  position: relative;
  border-radius: 20px;
  padding: 16px;
  background: linear-gradient(180deg, rgba(14, 16, 24, 0.78), rgba(12, 14, 20, 0.58));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  /* 裁掉主按钮 hover 外扩阴影，避免叠到左侧牌桌、右侧座位的牌上像「光源」 */
  overflow: hidden;
}

.top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stage,
.pot {
  padding: 12px 12px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.title {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.value {
  margin-top: 6px;
  font-weight: 760;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.92);
}

.turn {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.26);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.turn[data-on='true'] {
  border-color: rgba(226, 184, 90, 0.45);
  background: radial-gradient(240px 80px at 10% 30%, rgba(226, 184, 90, 0.22), rgba(0, 0, 0, 0.2));
}

.spark {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.16)),
    linear-gradient(180deg, rgba(226, 184, 90, 0.9), rgba(226, 184, 90, 0.15));
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.t {
  color: rgba(255, 255, 255, 0.84);
  font-weight: 600;
}

.actions {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.actions .btn-soft,
.actions .btn-mint,
.actions .btn-rose {
  width: 100%;
}

.meta .btn-soft {
  flex: 1;
  min-width: 0;
}

.raise {
  margin-top: 14px;
  border-radius: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.label {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.slider {
  width: 100%;
  margin: 6px 0 12px;
}

.raise .btn-gold {
  width: 100%;
}

.meta {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

.handResultOverlay {
  position: absolute;
  inset: 0;
  display: grid;
  align-items: start;
  justify-items: stretch;
  padding: 10px;
  z-index: 20;
}

.handResultBackdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  border-radius: 20px;
}

.handResultPanel {
  position: relative;
  z-index: 21;
  border-radius: 16px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(14, 16, 24, 0.96), rgba(8, 10, 16, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.6);
  max-height: calc(100svh - 80px);
  overflow: auto;
}

.handResultHd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.handResultTitle {
  font-weight: 760;
  color: rgba(255, 255, 255, 0.92);
}

.handResultGrid {
  display: grid;
  gap: 8px;
}

.handResultRow {
  display: grid;
  grid-template-columns: 110px 74px 1fr;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.handResultRow[data-w='true'] {
  border-color: rgba(226, 184, 90, 0.38);
  background: radial-gradient(420px 120px at 10% 10%, rgba(226, 184, 90, 0.18), rgba(255, 255, 255, 0.04));
}

.nm {
  font-weight: 750;
}

.st {
  color: rgba(255, 255, 255, 0.75);
}

.hn {
  color: rgba(255, 255, 255, 0.88);
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}

.hn-sub {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 650;
}

.badges {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.rankBadge {
  font-size: 12px;
  font-weight: 850;
  padding: 2px 7px;
  border-radius: 999px;
  color: rgba(226, 184, 90, 0.95);
  background: rgba(226, 184, 90, 0.12);
  border: 1px solid rgba(226, 184, 90, 0.28);
}

.handResultPots {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.pt {
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pt-h {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.76);
  margin-bottom: 6px;
}

.pt-b {
  display: grid;
  gap: 4px;
  color: rgba(255, 255, 255, 0.82);
}

.l {
  font-size: 13px;
}
</style>

