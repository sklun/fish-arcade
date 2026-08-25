<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Ban, ChevronDown, Clock3, Gamepad2, Info, Play, UserRound } from '@lucide/vue'

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
const expandedLevels = ref<Record<GameId, boolean>>({ arrow: false, 'find-aemeath': false })
const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const currentDateTime = ref('')
let initialized = false
let clockTimer: number | undefined
const availableGameCount = computed(() => gameCatalog.filter((game) => game.availability.available).length)
const sortedGameCatalog = computed(() =>
  [...gameCatalog].sort((left, right) => Number(right.availability.available) - Number(left.availability.available)),
)

const refreshCurrentDateTime = (): void => {
  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  )
  currentDateTime.value = `${parts.year} / ${parts.month} / ${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

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

const selectedLevelNumber = (gameId: GameId): number => selectedLevels.value[gameId] + 1

const difficultyLabel = (levelNumber: number): string => (levelNumber % 5 === 0 ? '困难' : '普通')

const levelOptions = (gameId: GameId): number[] =>
  Array.from({ length: progressByGame.value[gameId].highestUnlockedLevel + 1 }, (_, index) => index)

const selectLevel = (gameId: GameId, levelIndex: number): void => {
  selectedLevels.value[gameId] = levelIndex
  expandedLevels.value[gameId] = false
}

const toggleLevelPicker = (gameId: GameId): void => {
  expandedLevels.value[gameId] = !expandedLevels.value[gameId]
}

const gameHref = (game: GameCatalogEntry): string =>
  createLevelHref(game.playHref, selectedLevels.value[game.id])

const availabilityReason = (game: GameCatalogEntry): string =>
  game.availability.available ? '' : game.availability.reason

onMounted(() => {
  refreshProgress()
  refreshCurrentDateTime()
  clockTimer = window.setInterval(refreshCurrentDateTime, 1_000)
  window.addEventListener('pageshow', refreshProgress)
  window.addEventListener('storage', refreshProgress)
})

onBeforeUnmount(() => {
  if (clockTimer !== undefined) window.clearInterval(clockTimer)
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
        <span class="availability"><i aria-hidden="true"></i> {{ availableGameCount }} 款可玩</span>
        <span class="edition" title="Asia/Shanghai 当前日期时间">{{ currentDateTime }}</span>
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
        <article v-for="game in sortedGameCatalog" :key="game.id" class="game-entry">
          <div class="game-entry__copy">
            <div class="game-entry__number" aria-hidden="true">{{ game.index }}</div>
            <div class="game-entry__title-row">
              <div>
                <p class="game-entry__kind">{{ game.kind }}</p>
                <h2>{{ game.title }} <span>{{ game.englishTitle }}</span></h2>
              </div>
              <span
                class="live-badge"
                :class="{ 'live-badge--unavailable': !game.availability.available }"
                :aria-label="game.availability.available ? '可玩' : `不可用：${availabilityReason(game)}`"
              >
                <i aria-hidden="true"></i>{{ game.availability.available ? '可玩' : '不可用' }}
              </span>
            </div>

            <p class="game-entry__summary">{{ game.summary }}</p>

            <p v-if="!game.availability.available" class="game-entry__availability-note" role="status">
              <Info :size="17" aria-hidden="true" />
              <span><strong>暂不可用</strong>{{ availabilityReason(game) }}</span>
            </p>

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

            <div class="level-actions">
              <section class="level-selector" :aria-label="`${game.title}当前关卡`">
                <button
                  class="level-selector__trigger"
                  :aria-controls="`${game.id}-level-picker`"
                  :aria-expanded="expandedLevels[game.id]"
                  :aria-label="game.availability.available
                    ? `当前第${selectedLevelNumber(game.id)}关，${difficultyLabel(selectedLevelNumber(game.id))}难度，点击选择关卡`
                    : `当前第${selectedLevelNumber(game.id)}关，游戏不可用：${availabilityReason(game)}`"
                  :disabled="!game.availability.available"
                  type="button"
                  @click="toggleLevelPicker(game.id)"
                >
                  <span>当前关卡</span>
                  <strong>
                    第 {{ selectedLevelNumber(game.id) }} 关
                    <i
                      class="difficulty-dot"
                      :class="{ 'difficulty-dot--hard': selectedLevelNumber(game.id) % 5 === 0 }"
                      aria-hidden="true"
                    ></i>
                  </strong>
                  <ChevronDown
                    class="level-selector__trigger-icon"
                    :class="{ 'level-selector__trigger-icon--open': expandedLevels[game.id] }"
                    :size="16"
                    aria-hidden="true"
                  />
                </button>

                <div v-if="expandedLevels[game.id]" :id="`${game.id}-level-picker`" class="level-selector__popover">
                  <div class="level-calendar__legend" aria-label="难度颜色">
                    <span><i class="difficulty-dot" aria-hidden="true"></i>普通</span>
                    <span><i class="difficulty-dot difficulty-dot--hard" aria-hidden="true"></i>困难</span>
                  </div>
                  <div class="level-calendar">
                    <button
                      v-for="levelIndex in levelOptions(game.id)"
                      :key="levelIndex"
                      class="level-tile"
                      :class="{
                        'level-tile--hard': (levelIndex + 1) % 5 === 0,
                        'level-tile--selected': selectedLevels[game.id] === levelIndex,
                      }"
                      :aria-label="`第${levelIndex + 1}关，${difficultyLabel(levelIndex + 1)}难度`"
                      :aria-pressed="selectedLevels[game.id] === levelIndex"
                      type="button"
                      @click="selectLevel(game.id, levelIndex)"
                    >
                      {{ levelIndex + 1 }}
                    </button>
                  </div>
                </div>
              </section>

              <a v-if="game.availability.available" class="play-button" :href="gameHref(game)">
                <Play :size="20" fill="currentColor" aria-hidden="true" />
                {{ progressByGame[game.id].completedLevels > 0 ? '继续游戏' : '开始游戏' }}
              </a>
              <button v-else class="play-button play-button--disabled" type="button" disabled>
                <Ban :size="19" aria-hidden="true" />
                暂不可用
              </button>
            </div>
          </div>

          <component
            :is="game.availability.available ? 'a' : 'div'"
            class="game-entry__visual"
            :class="`game-entry__visual--${game.artwork}`"
            :href="game.availability.available ? gameHref(game) : undefined"
            :aria-label="game.availability.available
              ? `开始${game.title}第${selectedLevelNumber(game.id)}关`
              : `${game.title}暂不可用：${availabilityReason(game)}`"
            :aria-disabled="!game.availability.available"
          >
            <img :src="game.image" :alt="game.imageAlt" />

            <template v-if="game.artwork === 'arrow'">
              <span class="arrow-art__wordmark">ARROW <b>箭序</b></span>
              <span class="arrow-art__kicker">顺序决定出口</span>
              <strong class="arrow-art__title">ARROW</strong>
              <span class="arrow-art__cn">箭序</span>
            </template>

            <template v-else>
              <span class="aemeath-art__protocol">AEMEATH SEARCH PROTOCOL</span>
              <span class="aemeath-art__kicker">LOCATE THE SIGNAL</span>
              <strong class="aemeath-art__title">寻找<br /><em>爱弥斯</em></strong>
              <span class="aemeath-art__portrait">
                <img :src="game.portraitImage" alt="" />
              </span>
              <span class="aemeath-art__caption">TARGET / AEMEATH</span>
            </template>
          </component>
        </article>
      </section>
    </main>

    <footer class="footer">
      <span>FISH ARCADE</span>
      <span>更多游戏，正在入场</span>
    </footer>
  </div>
</template>
