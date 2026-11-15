import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'urql'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import { LangProvider } from './i18n'
import { client } from './graphql/client'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider value={client}>
      <ThemeProvider>
        <LangProvider>
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </LangProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
