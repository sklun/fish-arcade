<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Clock3, Gamepad2, Play, Trophy, UserRound } from '@lucide/vue'

import { gameCatalog, type GameCatalogEntry, type GameId } from './games'
import { createLevelHref, readGameProgress, type GameProgress } from './progress'

type ProgressByGame = Record<GameId, GameProgress>
type SelectedLevels = Record<GameId, number>

const emptyProgress = (): ProgressByGame => ({
  arrow: { completedLevels: 0, highestUnlockedLevel: 0 },
  'find-aemeath': { completedLevels: 0, highestUnlockedLevel: 0 },
})

const progressByGame = ref<ProgressByGame>(emptyProgress())
const selectedLevels = ref<SelectedLevels>({ arrow: 0, 'find-aemeath': 0 })
let initialized = false

const refreshProgress = (): void => {
  for (const game of gameCatalog) {
    const progress = readGameProgress(game.id)
    progressByGame.value[game.id] = progress
    if (!initialized || selectedLevels.value[game.id] > progress.highestUnlockedLevel) {
      selectedLevels.value[game.id] = progress.highestUnlockedLevel
    }
  }
  initialized = true
}

const levelOptions = (gameId: GameId): number[] =>
  Array.from({ length: progressByGame.value[gameId].highestUnlockedLevel + 1 }, (_, index) => index)

const selectedLevelNumber = (gameId: GameId): number => selectedLevels.value[gameId] + 1

const difficultyLabel = (gameId: GameId): string =>
  selectedLevelNumber(gameId) % 5 === 0 ? '困难' : '普通'

const chapterLabel = (gameId: GameId): string =>
  `第 ${Math.floor(selectedLevels.value[gameId] / 5) + 1} 组 · ${difficultyLabel(gameId)}`

const chapterProgress = (gameId: GameId): string =>
  `${((selectedLevels.value[gameId] % 5) + 1) * 20}%`

const gameHref = (game: GameCatalogEntry): string =>
  createLevelHref(game.playHref, selectedLevels.value[game.id])

onMounted(() => {
  refreshProgress()
  window.addEventListener('pageshow', refreshProgress)
  window.addEventListener('storage', refreshProgress)
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', refreshProgress)
  window.removeEventListener('storage', refreshProgress)
})
</script>

<template>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Fish Arcade 首页">
        <span class="brand__mark" aria-hidden="true"><Gamepad2 :size="20" /></span>
        <span>FISH <b>ARCADE</b></span>
      </a>
      <div class="topbar__meta">
        <span class="availability"><i aria-hidden="true"></i> {{ gameCatalog.length }} 款可玩</span>
        <span class="edition">2026 / 01</span>
      </div>
    </header>

    <main>
      <section class="catalog-heading" aria-labelledby="catalog-title">
        <div>
          <p class="eyebrow">PLAY NOW</p>
          <h1 id="catalog-title">鱼群就在前面</h1>
        </div>
        <p class="catalog-heading__intro">选好关卡，马上开始。</p>
      </section>

      <section class="game-list" aria-label="游戏列表">
        <article v-for="game in gameCatalog" :key="game.id" class="game-entry">
          <div class="game-entry__copy">
            <div class="game-entry__number" aria-hidden="true">{{ game.index }}</div>
            <div class="game-entry__title-row">
              <div>
                <p class="game-entry__kind">{{ game.kind }}</p>
                <h2>{{ game.title }} <span>{{ game.englishTitle }}</span></h2>
              </div>
              <span class="live-badge">可玩</span>
            </div>

            <p class="game-entry__summary">{{ game.summary }}</p>

            <dl class="game-entry__facts">
              <div>
                <dt><UserRound :size="17" aria-hidden="true" /> 模式</dt>
                <dd>{{ game.mode }}</dd>
              </div>
              <div>
                <dt><Clock3 :size="17" aria-hidden="true" /> 单局</dt>
                <dd>{{ game.duration }}</dd>
              </div>
              <div>
                <dt><Gamepad2 :size="17" aria-hidden="true" /> 操作</dt>
                <dd>{{ game.controls }}</dd>
              </div>
            </dl>

            <section class="level-progress" :aria-label="`${game.title}关卡进度`">
              <div class="level-progress__heading">
                <span><Trophy :size="17" aria-hidden="true" /> 关卡进度</span>
                <strong>已通过 {{ progressByGame[game.id].completedLevels }} 关</strong>
              </div>
              <div class="level-progress__controls">
                <label>
                  <span>选择关卡</span>
                  <select v-model.number="selectedLevels[game.id]">
                    <option v-for="levelIndex in levelOptions(game.id)" :key="levelIndex" :value="levelIndex">
                      第 {{ levelIndex + 1 }} 关{{ (levelIndex + 1) % 5 === 0 ? ' · 困难' : '' }}
                    </option>
                  </select>
                </label>
                <div class="level-progress__stage">
                  <span>{{ chapterLabel(game.id) }}</span>
                  <div class="progress-track" aria-hidden="true">
                    <i :style="{ width: chapterProgress(game.id) }"></i>
                  </div>
                </div>
              </div>
            </section>

            <a class="play-button" :href="gameHref(game)">
              <Play :size="20" fill="currentColor" aria-hidden="true" />
              {{ progressByGame[game.id].completedLevels > 0 ? '继续游戏' : '开始游戏' }}
              <span>第 {{ selectedLevelNumber(game.id) }} 关</span>
            </a>
          </div>

          <a
            class="game-entry__visual"
            :class="`game-entry__visual--${game.artwork}`"
            :href="gameHref(game)"
            :aria-label="`开始${game.title}第${selectedLevelNumber(game.id)}关`"
          >
            <img :src="game.image" :alt="game.imageAlt" />

            <template v-if="game.artwork === 'arrow'">
              <span class="arrow-art__wordmark">ARROW <b>箭序</b></span>
              <span class="arrow-art__kicker">顺序决定出口</span>
              <strong class="arrow-art__title">ARROW</strong>
              <span class="arrow-art__cn">箭序</span>
              <span class="arrow-art__progress">第 {{ selectedLevelNumber(game.id) }} 关 · {{ difficultyLabel(game.id) }}</span>
            </template>

            <template v-else>
              <span class="aemeath-art__protocol">AEMEATH SEARCH PROTOCOL</span>
              <span class="aemeath-art__kicker">LOCATE THE SIGNAL</span>
              <strong class="aemeath-art__title">寻找<br /><em>爱弥斯</em></strong>
              <span class="aemeath-art__progress">第 {{ selectedLevelNumber(game.id) }} 关 · {{ difficultyLabel(game.id) }}</span>
              <span class="aemeath-art__portrait">
                <img :src="game.portraitImage" alt="" />
              </span>
              <span class="aemeath-art__caption">TARGET / AEMEATH</span>
            </template>
          </a>
        </article>
      </section>
    </main>

    <footer class="footer">
      <span>FISH ARCADE</span>
      <span>更多游戏，正在入场</span>
    </footer>
  </div>
</template>
