import {createRouter, createWebHistory} from 'vue-router'

import GameView from '@/app/views/GameView.vue'
import ResultView from '@/app/views/ResultView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {path: '/', redirect: '/game'},
        {path: '/game', name: 'game', component: GameView},
        {path: '/result', name: 'result', component: ResultView},
        {path: '/:pathMatch(.*)*', redirect: '/game'},
    ],
})

export default router
