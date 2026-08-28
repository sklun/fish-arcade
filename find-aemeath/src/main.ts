import {createApp} from 'vue'
import {createPinia} from 'pinia'

import App from '@/app/App.vue'
import router from '@/app/router'
import {getAnonymousUserId} from '@/storage/anonymous-user'
import '@/styles/tokens.css'
import '@/styles/game.css'

getAnonymousUserId()
createApp(App).use(createPinia()).use(router).mount('#app')
