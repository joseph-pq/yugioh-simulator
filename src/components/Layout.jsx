import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-panel border-b border-[var(--color-border)] rounded-none">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-gold-400)] to-[var(--color-gold-700)] flex items-center justify-center text-sm font-bold text-[var(--color-bg-primary)] group-hover:shadow-[var(--shadow-glow-gold)] transition-shadow duration-300">
              DL
            </div>
            <span className="text-lg font-semibold bg-gradient-to-r from-[var(--color-gold-300)] to-[var(--color-gold-500)] bg-clip-text text-transparent">
              Combo Simulator
            </span>
          </NavLink>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/build"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-gold-500)]/15 text-[var(--color-gold-400)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`
              }
            >
              Deck Builder
            </NavLink>
            <NavLink
              to="/sim"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-gold-500)]/15 text-[var(--color-gold-400)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`
              }
            >
              Simulator
            </NavLink>
          </div>

          {/* Status indicator */}
          <span className="text-[var(--color-accent-teal)] flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-teal)]" />
            Ready
          </span>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

