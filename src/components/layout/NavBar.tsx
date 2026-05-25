import { NavLink, useLocation } from 'react-router-dom';
import { useProfileStore } from '../../store/useProfileStore';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Hub', icon: '⚡' },
  { path: '/rituels', label: 'Rituels', icon: '✓' },
  { path: '/nutrition', label: 'Nutrition', icon: '🎯' },
  { path: '/entrainement', label: 'Training', icon: '💪' },
  { path: '/classement', label: 'Classement', icon: '🏆' },
  { path: '/progression', label: 'Progrès', icon: '📈' },
];

export default function NavBar() {
  const profile = useProfileStore((s) => s.profile);
  const location = useLocation();

  return (
    <>
      {/* Desktop top bar */}
      <nav
        className="hidden md:flex items-center justify-between px-6 py-3 sticky top-0 z-40"
        style={{ background: 'rgba(7,12,26,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <NavLink to="/dashboard">
          <span className="font-display text-xl tracking-widest" style={{ color: 'var(--blue-bright)' }}>
            FAT<span style={{ color: 'var(--cyan)' }}>LOCK</span>
          </span>
        </NavLink>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-[var(--panel)] text-[var(--blue-bright)] border border-[var(--blue)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <NavLink
          to="/parametres"
          className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--blue)', color: 'white' }}
          >
            {profile?.name?.charAt(0).toUpperCase()}
          </div>
        </NavLink>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around py-2 px-2"
        style={{ background: 'rgba(7,12,26,0.97)', borderTop: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 px-2 py-1"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  isActive ? 'text-[var(--blue-bright)]' : 'text-[var(--muted2)]'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
        <NavLink to="/parametres" className="flex flex-col items-center gap-0.5 px-2 py-1">
          <span className="text-lg leading-none">⚙</span>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              location.pathname === '/parametres' ? 'text-[var(--blue-bright)]' : 'text-[var(--muted2)]'
            }`}
          >
            Réglages
          </span>
        </NavLink>
      </nav>
    </>
  );
}