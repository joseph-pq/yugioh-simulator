import { Routes, Route } from 'react-router-dom'
import { CacheProvider } from './context/CacheContext'
import { DeckProvider } from './context/DeckContext'
import { GameProvider } from './context/GameContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import SimulatorPage from './pages/SimulatorPage'

export default function App() {
  return (
    <CacheProvider>
      <DeckProvider>
        <GameProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/build" element={<DeckBuilderPage />} />
              <Route path="/sim" element={<SimulatorPage />} />
            </Route>
          </Routes>
        </GameProvider>
      </DeckProvider>
    </CacheProvider>
  )
}
