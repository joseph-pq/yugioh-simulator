import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-[var(--color-border)] rounded-none">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-gold-400)] to-[var(--color-gold-700)] flex items-center justify-center text-sm font-bold text-[var(--color-bg-primary)] group-hover:shadow-[var(--shadow-glow-gold)] transition-shadow duration-300">
              DL
            </div>
            <span className="hidden sm:inline text-lg font-semibold bg-gradient-to-r from-[var(--color-gold-300)] to-[var(--color-gold-500)] bg-clip-text text-transparent">
              Combo Simulator
            </span>
          </NavLink>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/build"
              className={({ isActive }) =>
                `px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-gold-500)]/15 text-[var(--color-gold-400)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`
              }
            >
              <span className="sm:hidden">Deck</span>
              <span className="hidden sm:inline">Deck Builder</span>
            </NavLink>
            <NavLink
              to="/sim"
              className={({ isActive }) =>
                `px-2 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-gold-500)]/15 text-[var(--color-gold-400)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`
              }
            >
              Simulator
            </NavLink>
          </div>

          {/* GitHub Link */}
          <a
            href="https://github.com/joseph-pq/yugioh-simulator"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-200"
            title="View on GitHub"
            aria-label="View on GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
