import React from 'react';
import { Home, Compass, Bookmark, CheckCircle2, Layers, User, LucideIcon, Sparkles, Film } from 'lucide-react';
import { useCinema, TabType } from '../../context/CinemaContext';

interface NavItemDef {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

const DESKTOP_NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'watched', label: 'Watched', icon: CheckCircle2 },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'profile', label: 'Profile', icon: User },
];

const MOBILE_NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'watched', label: 'Watched', icon: CheckCircle2 },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'profile', label: 'Profile', icon: User },
];

export const CinemaDesktopNav: React.FC = () => {
  const { activeTab, setActiveTab, selectedMovieId, selectedCollectionId, closeMovieDetail, closeCollectionDetail } = useCinema();

  const handleTabClick = (tab: TabType) => {
    if (selectedMovieId) closeMovieDetail();
    if (selectedCollectionId) closeCollectionDetail();
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 bottom-0 w-[240px] z-40 p-6 flex-col justify-between"
      style={{
        background: 'rgba(10, 10, 14, 0.88)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
      }}
    >
      <div>
        {/* MyCinema Brand Mark */}
        <div
          onClick={() => handleTabClick('home')}
          className="flex items-center gap-3 px-3 py-3 mb-8 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#E0AD52] to-[#D19830] text-[#09090B] shadow-[0_4px_20px_rgba(224,173,82,0.35)] group-hover:scale-105 transition-transform duration-300">
            <Film size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-serif font-black text-[18px] tracking-[0.2em] text-[#F5F3EB] leading-none">
              MYCINEMA
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && !selectedMovieId && !selectedCollectionId;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold text-left transition-all duration-200 border-none cursor-pointer group min-h-[44px] ${
                  isActive
                    ? 'bg-[#E0AD52]/12 text-[#E0AD52] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F3EB] hover:bg-white/[0.04]'
                }`}
                style={{
                  borderLeft: isActive ? '3px solid #E0AD52' : '3px solid transparent',
                }}
              >
                <Icon
                  size={20}
                  className={`transition-transform duration-200 ${
                    isActive ? 'text-[#E0AD52] scale-110' : 'text-[#9E9DA5] group-hover:text-[#F5F3EB]'
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="px-3 py-3 border-t border-white/[0.06] text-[11px] text-[#63626B] flex items-center justify-between">
        <div>
          <div className="text-[#9E9DA5] font-semibold">Offline Ready</div>
          <div>Local-First Vault</div>
        </div>
        <Sparkles size={14} className="text-[#E0AD52]/60" />
      </div>
    </aside>
  );
};

export const CinemaMobileNav: React.FC = () => {
  const { activeTab, setActiveTab, selectedMovieId, selectedCollectionId, closeMovieDetail, closeCollectionDetail } = useCinema();

  const handleTabClick = (tab: TabType) => {
    if (selectedMovieId) closeMovieDetail();
    if (selectedCollectionId) closeCollectionDetail();
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E14]/96 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <nav
        className="max-w-md mx-auto flex items-center justify-around px-1 h-[60px]"
        aria-label="Mobile Navigation"
      >
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && !selectedMovieId && !selectedCollectionId;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className="group flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[48px] py-1 px-0.5 bg-transparent border-none cursor-pointer transition-all duration-150 select-none"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`relative flex items-center justify-center transition-transform duration-200 ${
                  isActive ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-[#E0AD52] drop-shadow-[0_0_8px_rgba(224,173,82,0.45)]' : 'text-[#8E8D94] group-hover:text-[#F5F3EB]'
                  }`}
                />
              </div>
              <span
                className={`text-[11px] tracking-tight mt-0.5 transition-colors leading-none ${
                  isActive
                    ? 'font-bold text-[#E0AD52]'
                    : 'font-medium text-[#8E8D94] group-hover:text-[#F5F3EB]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export const Navbar: React.FC = () => {
  return (
    <>
      <CinemaDesktopNav />
      <CinemaMobileNav />
    </>
  );
};
