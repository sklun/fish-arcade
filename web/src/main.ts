import {createApp} from 'vue'

import App from './App.vue'
import './styles.css'
import {getAnonymousUserId} from './user'

getAnonymousUserId()
createApp(App).mount('#app')
