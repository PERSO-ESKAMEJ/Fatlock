import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const entries = useProfileStore((s) => s.entries);
  const activeId = useProfileStore((s) => s.activeId);
  const switchEntry = useProfileStore((s) => s.switchEntry);
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleSwitch(profileId: string) {
    switchEntry(profileId);
    setOpen(false);
    navigate('/dashboard');
  }

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

        {/* Avatar + group switcher */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--blue)', color: 'white' }}
            >
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-[var(--muted)] text-xs">▾</span>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                {entries.map((entry) => (
                  <button
                    key={entry.profile.id}
                    onClick={() => handleSwitch(entry.profile.id)}
                    className="w-full px-4 py-3 text-left hover:bg-[var(--panel2)] flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-sm font-bold text-[var(--ink)]">{entry.profile.name}</div>
                      <div className="text-xs text-[var(--muted)]">{entry.challenge.groupName}</div>
                    </div>
                    {entry.profile.id === activeId && (
                      <span className="text-xs font-bold" style={{ color: 'var(--green)' }}>✓</span>
                    )}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => { setOpen(false); navigate('/parametres'); }}
                    className="w-full px-4 py-3 text-left text-xs hover:bg-[var(--panel2)] transition-colors"
                    style={{ color: 'var(--muted)' }}
                  >
                    ⚙ Paramètres
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate('/?add=1'); }}
                    className="w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-wider hover:bg-[var(--panel2)] transition-colors"
                    style={{ color: 'var(--blue-bright)' }}
                  >
                    + Rejoindre un groupe
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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