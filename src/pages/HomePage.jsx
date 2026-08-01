import { Link } from 'react-router-dom'
import { useCacheContext } from '../context/CacheContext'

export default function HomePage() {
  const { cacheStatus, totalCards } = useCacheContext()

  return (
    <div className="min-h-[calc(100dvh-56px)] flex flex-col">
      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-3xl text-center animate-slide-up relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[var(--color-gold-500)]/5 blur-3xl" />
            <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-[var(--color-accent-blue)]/5 blur-3xl" />
          </div>

          <div className="inline-flex items-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-gold-300)] to-[var(--color-gold-700)] flex items-center justify-center text-3xl font-black text-[var(--color-bg-primary)] shadow-[var(--shadow-glow-gold)] animate-glow">
              DL
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
            <span className="bg-gradient-to-r from-[var(--color-gold-200)] via-[var(--color-gold-400)] to-[var(--color-gold-200)] bg-clip-text text-transparent">
              Duel Links
            </span>
            <br />
            <span className="text-[var(--color-text-primary)]">Combo Simulator</span>
          </h1>

          <p className="text-lg text-[var(--color-text-secondary)] mb-8 max-w-xl mx-auto leading-relaxed">
            Build decks, simulate opening hands, record combos, and share them
            via URL — all in your browser. No backend, no login required.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Link to="/build" className="px-8 py-3 rounded-xl bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] font-semibold text-lg hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] shadow-[var(--shadow-glow-gold)] transition-all duration-300 active:scale-95">
              Build a Deck
            </Link>
            <Link to="/sim" className="px-8 py-3 rounded-xl border border-[var(--color-border-light)] text-[var(--color-text-primary)] font-semibold text-lg hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-gold-600)] transition-all duration-300 active:scale-95">
              Open Simulator
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <FeatureCard icon="📥" title="Import from YDK" description="Drop your .ydk file from Duel Links Meta and load your deck instantly." />
            <FeatureCard icon="🎬" title="Record Combos" description="Step-by-step combo recording with playback and annotations." />
            <FeatureCard icon="🔗" title="Share via URL" description="Deck and combo compressed into a single shareable link." />
          </div>

          {cacheStatus === 'ready' && (
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-[var(--color-text-muted)]">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--color-accent-teal)]" />{totalCards.toLocaleString()} cards</span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--color-accent-purple)]" />Duel Links format</span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--color-gold-400)]" />100% client-side</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="glass-panel p-5 hover:border-[var(--color-gold-600)]/50 transition-all duration-300 group">
      <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
    </div>
  )
}
