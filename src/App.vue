<script setup lang="ts">
import { ref } from 'vue'
import TableTop from './components/TableTop.vue'
import { useGameStore } from './stores/game'

const game = useGameStore()

const inGame = ref(false)
const selected = ref<number>(game.tableSize)

function enterGame() {
  game.setTableSize(selected.value)
  inGame.value = true
}
</script>

<template>
  <div v-if="!inGame" class="pregame">
    <div class="card">
      <div class="title">德州扑克</div>
      <div class="sub">选择参与人数（1 真人 + N-1 AI）</div>

      <div class="row">
        <label class="lbl" for="tableSize">人数</label>
        <select id="tableSize" class="select" v-model.number="selected">
          <option v-for="n in [2, 3, 4, 5, 6]" :key="n" :value="n">{{ n }} 人</option>
        </select>
      </div>

      <button type="button" class="btn-gold btn-gold--tile" @click="enterGame">进入牌桌</button>
    </div>
  </div>
  <TableTop v-else />
</template>

<style scoped>
.pregame {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 28px 16px;
}

.card {
  width: min(520px, 100%);
  padding: 18px 18px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(9, 13, 25, 0.9), rgba(4, 6, 12, 0.78));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
}

.title {
  font-family: var(--display);
  letter-spacing: 0.2px;
  font-size: 26px;
  margin-bottom: 6px;
}

.sub {
  color: var(--muted);
  font-size: 14px;
  margin-bottom: 14px;
}

.row {
  display: grid;
  grid-template-columns: 70px 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.lbl {
  color: var(--muted);
  font-size: 13px;
}

.select {
  appearance: none;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--ink);
  outline: none;
  cursor: pointer;
}

.card .btn-gold {
  width: 100%;
}
</style>
