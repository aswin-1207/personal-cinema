import React from 'react';
import { Home, Compass, BookOpen, Layers, Calendar, User, LucideIcon, Sparkles } from 'lucide-react';
import { useCinema, TabType } from '../../context/CinemaContext';

interface NavItemDef {
  id: TabType;
  label: string;
  icon: LucideIcon;
}

const DESKTOP_NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'calendar', label: 'Movie Night', icon: Calendar },
  { id: 'profile', label: 'My Cinema', icon: User },
];

const MOBILE_NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'profile', label: 'My Cinema', icon: User },
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
        background: 'rgba(10, 11, 17, 0.82)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
      }}
    >
      <div>
        {/* Cinema Brand Mark */}
        <div className="flex items-center gap-3 px-3 py-3 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-[#09090D] shadow-[0_4px_20px_rgba(237,194,87,0.35)]"
            style={{
              background: 'linear-gradient(135deg, #EDC257 0%, #D99C33 100%)',
            }}
          >
            ▶
          </div>
          <div>
            <div className="font-serif font-black text-[15px] tracking-[0.14em] text-[#F5F2F0] leading-none">
              PERSONAL
            </div>
            <div className="text-[10px] tracking-[0.24em] text-[#EDC257] font-extrabold mt-1">
              CINEMA
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
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all duration-200 border-none cursor-pointer group ${
                  isActive
                    ? 'bg-[rgba(237,194,87,0.12)] text-[#EDC257] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-transparent text-[#9E9DA5] hover:text-[#F5F2F0] hover:bg-white/[0.04]'
                }`}
                style={{
                  borderLeft: isActive ? '3px solid #EDC257' : '3px solid transparent',
                }}
              >
                <Icon
                  size={18}
                  className={`transition-transform duration-200 ${
                    isActive ? 'text-[#EDC257] scale-110' : 'text-[#9E9DA5] group-hover:text-[#F5F2F0]'
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="px-3 py-3 border-t border-white/[0.06] text-[11px] text-[#5C5B64] flex items-center justify-between">
        <div>
          <div className="text-[#9E9DA5] font-semibold">Private Cinema</div>
          <div>Local-First Vault</div>
        </div>
        <Sparkles size={14} className="text-[#EDC257]/60" />
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
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        height: 'calc(60px + env(safe-area-inset-bottom, 12px))',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        backgroundColor: 'rgba(10, 11, 18, 0.92)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.6)',
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id && !selectedMovieId && !selectedCollectionId;

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className="flex flex-col items-center justify-center flex-1 py-1.5 bg-transparent border-none cursor-pointer transition-all duration-200"
          >
            <div
              className={`p-1 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-[#EDC257]/15 text-[#EDC257] -translate-y-0.5' : 'text-[#8E8D94]'
              }`}
            >
              <Icon size={19} />
            </div>
            <span
              className={`text-[10px] tracking-wider mt-0.5 transition-colors ${
                isActive ? 'font-bold text-[#EDC257]' : 'font-medium text-[#737177]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
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
