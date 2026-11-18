import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/latin-600.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource-variable/manrope'
import { App } from '../../src/App'
import './style.css'

createRoot(document.getElementById('root')!).render(<App />)
