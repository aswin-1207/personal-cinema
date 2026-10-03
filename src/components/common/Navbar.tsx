import React from 'react';
import { Home, Compass, Bookmark, CheckCircle2, Layers, LucideIcon } from 'lucide-react';
import { useCinema, TabType } from '../../context/CinemaContext';
import { BrandLogo } from './BrandLogo';
import { getInitials } from '../ui/ProfileButton';

interface NavItemDef {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'watched', label: 'Watched', icon: CheckCircle2 },
  { id: 'collections', label: 'Collections', icon: Layers },
];

const isItemActive = (item: TabType, active: TabType) =>
  item === active || (item === 'profile' && active === 'reviews');

/** Tablet (icon rail) + desktop (full sidebar) navigation. */
export const CinemaDesktopNav: React.FC = () => {
  const { activeTab, setActiveTab, preferences } = useCinema();
  const profileActive = isItemActive('profile', activeTab);

  return (
    <nav
      aria-label="Main"
      className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[var(--cinema-sidebar-width)] flex-col bg-ink-2 border-r border-line"
    >
      <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 shrink-0">
        <button type="button" onClick={() => setActiveTab('home')} aria-label="MyCinema home" className="rounded-lg">
          <span className="lg:hidden">
            <BrandLogo variant="symbol" size={26} alt="" />
          </span>
          <span className="hidden lg:inline">
            <BrandLogo variant="inside" size={26} alt="MyCinema" />
          </span>
        </button>
      </div>

      <ul className="flex-1 flex flex-col gap-1 px-2.5 lg:px-3">
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item.id, activeTab);
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex flex-col lg:flex-row items-center gap-1 lg:gap-3 rounded-xl px-2 lg:px-3.5 py-2.5 lg:py-0 lg:min-h-11 text-[10px] lg:text-[14px] font-semibold transition-colors ${
                  active ? 'bg-gold/10 text-gold' : 'text-muted hover:text-text hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="p-2.5 lg:p-3 border-t border-line">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          aria-current={profileActive ? 'page' : undefined}
          className={`w-full flex flex-col lg:flex-row items-center gap-1 lg:gap-3 rounded-xl px-2 lg:px-3 py-2 text-[10px] lg:text-[14px] font-semibold transition-colors ${
            profileActive ? 'bg-gold/10 text-gold' : 'text-muted hover:text-text hover:bg-white/[0.04]'
          }`}
        >
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border shrink-0 ${
              profileActive ? 'bg-gold text-ink border-gold' : 'bg-surface-2 text-gold border-gold/30'
            }`}
            aria-hidden="true"
          >
            {getInitials(preferences.displayName)}
          </span>
          <span className="lg:truncate">My Cinema</span>
        </button>
      </div>
    </nav>
  );
};

/** Phone bottom bar. Profile lives in the page-header avatar. */
export const CinemaMobileNav: React.FC = () => {
  const { activeTab, setActiveTab } = useCinema();
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink/95 border-t border-line pb-[env(safe-area-inset-bottom,0px)] [@supports(backdrop-filter:blur(1px))]:bg-ink/85 [@supports(backdrop-filter:blur(1px))]:backdrop-blur-lg"
    >
      <ul className="grid grid-cols-5 h-[var(--cinema-nav-height-mobile)] max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item.id, activeTab);
          const Icon = item.icon;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full h-full flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors ${
                  active ? 'text-gold' : 'text-subtle hover:text-muted'
                }`}
              >
                {active && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-gold" aria-hidden="true" />}
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
