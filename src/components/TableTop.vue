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

const handWinnersLabel = computed(() => {
  if (game.state.stage !== 'end') return null
  if (!game.lastShowdown) return null
  const names = game.lastShowdown.winners.map((i) => game.state.players[i]?.name).filter((v): v is string => Boolean(v))
  return names.length > 0 ? names.join('、') : '—'
})

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
          :isWinner="game.state.stage === 'end' && (game.lastShowdown?.winners ?? []).includes(i)"
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
          <div class="pill" v-if="handWinnersLabel">
            <span class="k">本手赢家</span>
            <span class="v">{{ handWinnersLabel }}</span>
          </div>
          <div class="pill" v-if="game.me.status === 'fold'">
            <span class="k">状态</span>
            <span class="v">已弃牌</span>
          </div>
          <div class="pill" v-if="equityPct !== null">
            <span class="k">摊牌胜率（对手随机·抽样）</span>
            <span class="v">
              {{ Math.round((game.equity?.win ?? 0) * 1000) / 10 }}%
              <span class="sub" v-if="game.equity">({{ game.equity.mode === 'exact' ? '精确' : '抽样' }} · {{ game.equity.samples }} · 不含下注弃牌)</span>
            </span>
          </div>
          <div class="pill" v-else-if="game.me.status === 'active' && game.equityComputing">
            <span class="k">摊牌胜率（对手随机·抽样）</span>
            <span class="v">计算中…</span>
          </div>
          <div class="pill">
            <span class="k">最高下注</span>
            <span class="v">{{ game.currentBet }}</span>
          </div>
          <button class="start" v-if="game.state.stage === 'end'" @click="game.start()">发牌</button>
        </div>

      </section>

      <div class="banner-wrap" v-if="game.noChipsBanner && !game.noChipsModal">
        <div class="banner" role="status" aria-live="polite">
          <div class="banner-text">当前筹码为 0，已淘汰</div>
          <button class="banner-btn" @click="game.resetMatch()">重新开始</button>
        </div>
      </div>

      <div class="modal-backdrop" v-if="game.noChipsModal" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="modal-title">当前筹码为 0</div>
          <div class="modal-sub">需要重新开始才能继续发牌。</div>
          <button class="modal-btn" @click="game.resetMatch()">重新开始</button>
        </div>
      </div>

      <div class="modal-backdrop" v-else-if="game.matchWonModal" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="modal-title">你已赢下整桌</div>
          <div class="modal-sub">其他玩家筹码为 0，比赛结束。</div>
          <button class="modal-btn" @click="game.resetMatch()">重新开始</button>
        </div>
      </div>

    </div>

    <ActionBar
      :canAct="game.canAct"
      :toCall="game.meToCall"
      :minRaise="game.minRaise"
      :maxRaiseTo="maxRaiseTo"
      :stageLabel="stageLabel"
      :isYourTurn="game.state.currentPlayerIndex === 0 && game.state.stage !== 'end'"
      :pot="game.state.pot"
      :handResult="game.lastShowdown"
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

.banner-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.banner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(14, 16, 24, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.banner-text {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.banner-btn {
  border: none;
  padding: 8px 10px;
  border-radius: 999px;
  font-weight: 760;
  color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(180deg, rgba(226, 184, 90, 0.28), rgba(226, 184, 90, 0.08));
  border: 1px solid rgba(226, 184, 90, 0.28);
  cursor: pointer;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  pointer-events: auto;
}

.modal {
  width: min(360px, calc(100% - 32px));
  border-radius: 16px;
  padding: 14px;
  background: linear-gradient(180deg, rgba(14, 16, 24, 0.92), rgba(8, 10, 16, 0.82));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.6);
}

.modal-title {
  font-weight: 760;
  color: rgba(255, 255, 255, 0.92);
}

.modal-sub {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.modal-btn {
  margin-top: 12px;
  width: 100%;
  border: none;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 760;
  color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(180deg, rgba(226, 184, 90, 0.28), rgba(226, 184, 90, 0.08));
  border: 1px solid rgba(226, 184, 90, 0.28);
  cursor: pointer;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .centerZone {
    width: clamp(420px, 60vw, 720px);
  }
}
</style>

