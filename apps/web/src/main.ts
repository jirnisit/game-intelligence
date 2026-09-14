import { createApp } from 'vue'
import App from './app/App'
import './app/styles/base.css'
import { router } from './app/router'

createApp(App).use(router).mount('#app')
