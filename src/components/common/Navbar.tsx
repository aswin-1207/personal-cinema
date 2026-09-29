import React from 'react';
import { Home, Compass, BookOpen, Calendar, User, LucideIcon } from 'lucide-react';
import { useCinema, TabType } from '../../context/CinemaContext';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, selectedMovieId, selectedCollectionId, closeMovieDetail, closeCollectionDetail } = useCinema();

  const handleTabClick = (tab: TabType) => {
    if (selectedMovieId) closeMovieDetail();
    if (selectedCollectionId) closeCollectionDetail();
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: Array<{ id: TabType; label: string; icon: LucideIcon }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'profile', label: 'My Cinema', icon: User },
  ];

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 240,
          backgroundColor: 'var(--cinema-deep-navy)',
          borderRight: '1px solid var(--cinema-border)',
          zIndex: 40,
          padding: '28px 16px',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        className="desktop-sidebar"
      >
        <div>
          {/* Brand Logo */}
          <div style={{ padding: '0 12px 32px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, var(--cinema-gold), var(--cinema-amber))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cinema-black)',
                fontWeight: 900,
                fontSize: 18,
                boxShadow: '0 2px 10px var(--cinema-gold-glow)',
              }}
            >
              ▶
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '0.08em', color: 'var(--cinema-white)' }}>
                PERSONAL
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--cinema-gold)', fontWeight: 700 }}>
                CINEMA
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id && !selectedMovieId && !selectedCollectionId;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isActive ? 'rgba(237, 194, 87, 0.12)' : 'transparent',
                    color: isActive ? 'var(--cinema-gold)' : 'var(--cinema-silver)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--transition-fast)',
                    borderLeft: isActive ? '3px solid var(--cinema-gold)' : '3px solid transparent',
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ padding: '12px', fontSize: 11, color: 'var(--cinema-subtle)', borderTop: '1px solid var(--cinema-border)' }}>
          <div>Personal Cinema PWA</div>
          <div style={{ color: 'var(--cinema-gold)' }}>Local-First Edition</div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 'calc(62px + env(safe-area-inset-bottom, 12px))',
          backgroundColor: 'rgba(15, 18, 32, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--cinema-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
        className="mobile-bottom-nav"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !selectedMovieId && !selectedCollectionId;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--cinema-gold)' : 'var(--cinema-subtle)',
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                flex: 1,
                padding: '6px 0',
                transition: 'color var(--transition-fast), transform var(--transition-fast)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: flex !important; }
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </>
  );
};
