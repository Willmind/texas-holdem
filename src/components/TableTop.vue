<script setup lang="ts">
import { computed } from 'vue'
import CardView from './CardView.vue'
import PlayerSeat from './PlayerSeat.vue'
import ActionBar from './ActionBar.vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()

const stageLabel = computed(() => {
  const s = game.state.stage
  if (s === 'preflop') return 'Pre-Flop'
  if (s === 'flop') return 'Flop'
  if (s === 'turn') return 'Turn'
  if (s === 'river') return 'River'
  if (s === 'showdown') return 'Showdown'
  return 'End'
})

const maxRaiseTo = computed(() => game.me.bet + game.me.chips)
const revealAi = computed(() => game.state.stage === 'end' && game.state.communityCards.length === 5)
const equityPct = computed(() => (game.me.status === 'active' && game.equity ? Math.round(game.equity.equity * 1000) / 10 : null))

type SeatPosition = 'top' | 'topLeft' | 'topRight' | 'bottom' | 'bottomLeft' | 'bottomRight'

type BlindTag = '庄' | '小盲' | '大盲'

function seatPos(i: number): SeatPosition {
  // index 0 is always bottom (you)
  const mapByN: Record<number, SeatPosition[]> = {
    2: ['bottom', 'top'],
    3: ['bottom', 'topLeft', 'topRight'],
    4: ['bottom', 'bottomLeft', 'topLeft', 'topRight'],
    5: ['bottom', 'bottomLeft', 'topLeft', 'topRight', 'bottomRight'],
    6: ['bottom', 'bottomLeft', 'topLeft', 'top', 'topRight', 'bottomRight'],
  }
  const map: SeatPosition[] = mapByN[game.state.players.length] ?? mapByN[6]
  return map[i] ?? 'top'
}

function nextActiveFrom(fromIndex: number): number {
  const s = game.state
  const n = s.players.length
  for (let step = 1; step <= n; step += 1) {
    const i = (fromIndex + step) % n
    if (s.players[i]?.status === 'active') return i
  }
  return fromIndex
}

const blindTags = computed(() => {
  const s = game.state
  const n = s.players.length
  const map: Partial<Record<number, BlindTag>> = {}
  if (n < 2) return map

  const btn = ((s.dealerIndex % n) + n) % n
  const sb = nextActiveFrom(btn)
  const bb = nextActiveFrom(sb)

  map[btn] = '庄'
  map[sb] = '小盲'
  map[bb] = '大盲'
  return map
})
</script>

<template>
  <div class="layout">
    <div class="felt">
      <div class="rim" aria-hidden="true"></div>
      <div class="noise" aria-hidden="true"></div>

      <div class="seats" :class="`n${game.state.players.length}`">
        <PlayerSeat
          v-for="(p, i) in game.state.players"
          :key="p.id"
          :player="p"
          :position="seatPos(i)"
          :blindTag="blindTags[i]"
          :revealCards="i === 0 ? true : revealAi && p.status !== 'fold'"
          :isTurn="game.state.currentPlayerIndex === i && game.state.stage !== 'end'"
        />
      </div>

      <section class="centerZone">
        <div class="board">
          <CardView v-for="i in 5" :key="i" :card="game.state.communityCards[i - 1]" :dim="!game.state.communityCards[i - 1]" />
        </div>

        <div class="status">
          <div class="pill">
            <span class="k">底池</span>
            <span class="v">{{ game.state.pot }}</span>
          </div>
          <div class="pill" v-if="game.me.status === 'fold'">
            <span class="k">状态</span>
            <span class="v">已弃牌</span>
          </div>
          <div class="pill" v-if="equityPct !== null">
            <span class="k">赢下整桌概率（抽样）</span>
            <span class="v">
              {{ Math.round((game.equity?.win ?? 0) * 1000) / 10 }}%
              <span class="sub" v-if="game.equity">({{ game.equity.mode === 'exact' ? '精确' : '抽样' }} · {{ game.equity.samples }})</span>
            </span>
          </div>
          <div class="pill" v-else-if="game.me.status === 'active' && game.equityComputing">
            <span class="k">赢下整桌概率（抽样）</span>
            <span class="v">计算中…</span>
          </div>
          <div class="pill">
            <span class="k">最高下注</span>
            <span class="v">{{ game.currentBet }}</span>
          </div>
          <button class="start" v-if="game.state.stage === 'end'" @click="game.start()">发牌</button>
        </div>

        <section class="showdown" v-if="game.lastShowdown">
          <div class="hd">
            <div class="t">本手结果</div>
            <div class="s" v-if="game.lastShowdown.kind === 'fold'">（弃牌结束）</div>
            <div class="s" v-else>（摊牌/边池）</div>
          </div>

          <div class="grid">
            <div class="row" v-for="p in game.lastShowdown.perPlayer" :key="p.index" :data-w="game.lastShowdown.winners.includes(p.index)">
              <div class="nm">{{ p.name }}</div>
              <div class="st">{{ p.status }}</div>
              <div class="hn">{{ p.handName ?? '-' }}</div>
            </div>
          </div>

          <div class="pots" v-if="game.lastShowdown.kind === 'showdown' && game.lastShowdown.pots">
            <div class="pt" v-for="(pot, idx) in game.lastShowdown.pots" :key="idx">
              <div class="pt-h">边池 {{ idx + 1 }} · {{ pot.amount }}</div>
              <div class="pt-b">
                <div class="l">eligible: {{ pot.eligible.join(', ') }}</div>
                <div class="l">winners: {{ pot.winners.join(', ') }} · each {{ pot.share }} <span v-if="pot.remainder > 0">(+1×{{ pot.remainder }})</span></div>
              </div>
            </div>
          </div>
        </section>
      </section>

    </div>

    <ActionBar
      :canAct="game.canAct"
      :toCall="game.meToCall"
      :minRaise="game.minRaise"
      :maxRaiseTo="maxRaiseTo"
      :stageLabel="stageLabel"
      :isYourTurn="game.state.currentPlayerIndex === 0 && game.state.stage !== 'end'"
      :pot="game.state.pot"
      @fold="game.fold()"
      @call="game.call()"
      @raise="(to) => game.raiseTo(to)"
      @allin="game.allin()"
      @startHand="game.start()"
      @reset="game.resetMatch()"
    />
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  min-height: 100svh;
  padding: 18px;
  box-sizing: border-box;
}

.felt {
  position: relative;
  border-radius: 28px;
  overflow: hidden;
  background: radial-gradient(1300px 650px at 50% 30%, rgba(71, 255, 199, 0.16), rgba(0, 0, 0, 0) 55%),
    radial-gradient(900px 400px at 70% 60%, rgba(226, 184, 90, 0.13), rgba(0, 0, 0, 0) 62%),
    linear-gradient(180deg, rgba(5, 34, 26, 1), rgba(4, 22, 18, 1));
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 34px 100px rgba(0, 0, 0, 0.55);
  padding: 18px;
  display: grid;
  grid-template-rows: 1fr;
}

.seats {
  position: absolute;
  inset: 0;
  padding: 18px;
  pointer-events: none;

  --edge: clamp(12px, 1.6vw, 18px);
  --sideX: clamp(12px, 1.6vw, 18px);
  --cornerY: clamp(64px, 9vh, 96px);
}

.seats :deep(.seat) {
  pointer-events: auto;
  width: clamp(200px, 24vw, 320px);
  position: absolute;
}

.seats.n6 :deep(.seat) {
  width: clamp(190px, 22vw, 300px);
}

.seats :deep(.seat.top) {
  top: var(--edge);
  left: 50%;
  transform: translateX(-50%);
}

.seats.n6 :deep(.seat.top) {
  top: var(--edge);
}

.seats :deep(.seat.topLeft) {
  top: var(--cornerY);
  left: var(--sideX);
}

.seats.n6 :deep(.seat.topLeft) {
  top: var(--cornerY);
  left: var(--sideX);
}

.seats :deep(.seat.topRight) {
  top: var(--cornerY);
  right: var(--sideX);
}

.seats.n6 :deep(.seat.topRight) {
  top: var(--cornerY);
  right: var(--sideX);
}

.seats :deep(.seat.bottom) {
  bottom: var(--edge);
  left: 50%;
  transform: translateX(-50%);
}

.seats.n6 :deep(.seat.bottom) {
  bottom: var(--edge);
}

.seats :deep(.seat.bottomLeft) {
  bottom: var(--cornerY);
  left: var(--sideX);
}

.seats.n6 :deep(.seat.bottomLeft) {
  bottom: var(--cornerY);
  left: var(--sideX);
}

.seats :deep(.seat.bottomRight) {
  bottom: var(--cornerY);
  right: var(--sideX);
}

.seats.n6 :deep(.seat.bottomRight) {
  bottom: var(--cornerY);
  right: var(--sideX);
}

.rim {
  position: absolute;
  inset: 10px;
  border-radius: 22px;
  border: 1px solid rgba(226, 184, 90, 0.28);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.noise {
  position: absolute;
  inset: -80px;
  background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 45%),
    radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 55%);
  mix-blend-mode: overlay;
  opacity: 0.35;
  pointer-events: none;
}

.centerZone {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(520px, 56vw, 860px);
  max-width: calc(100% - 28px);
  display: grid;
  justify-items: center;
  gap: 14px;
  pointer-events: none;
}

.centerZone > * {
  pointer-events: auto;
}

.board {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.status {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
  max-width: 100%;
}

.pill {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.k {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.v {
  font-weight: 760;
  color: rgba(255, 255, 255, 0.92);
}

.sub {
  font-size: 12px;
  font-weight: 650;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 10px;
}

.start {
  border: none;
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 760;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(180deg, rgba(226, 184, 90, 0.28), rgba(226, 184, 90, 0.08));
  border: 1px solid rgba(226, 184, 90, 0.28);
  cursor: pointer;
}

.showdown {
  margin-top: 12px;
  width: 100%;
  border-radius: 18px;
  padding: 14px;
  background: rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}

.hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.t {
  font-family: var(--display);
  letter-spacing: -0.01em;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.s {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.grid {
  display: grid;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 140px 90px 1fr;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.row[data-w='true'] {
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
}

.pots {
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

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .centerZone {
    width: clamp(420px, 60vw, 720px);
  }
  .showdown {
    width: 100%;
  }
}
</style>

