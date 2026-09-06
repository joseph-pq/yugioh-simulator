import { Routes, Route } from 'react-router-dom'
import { CacheProvider } from './context/CacheContext'
import { DeckProvider } from './context/DeckContext'
import { GameProvider } from './context/GameContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import SimulatorPage from './pages/SimulatorPage'
import MyCombosPage from './pages/MyCombosPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

export default function App() {
  return (
    <AuthProvider>
      <CacheProvider>
        <DeckProvider>
          <GameProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/build" element={<DeckBuilderPage />} />
                <Route path="/sim" element={<SimulatorPage />} />
                <Route path="/c/:slug" element={<SimulatorPage />} />
                <Route path="/combos" element={<MyCombosPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
              </Route>
            </Routes>
          </GameProvider>
        </DeckProvider>
      </CacheProvider>
    </AuthProvider>
  )
}
