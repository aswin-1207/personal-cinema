import React, { useEffect, useState } from 'react';
import { CinemaDesktopNav, CinemaMobileNav } from '../common/Navbar';
import { OfflineIndicator } from '../common/OfflineIndicator';
import { Toast } from '../common/Toast';
import { CollectionCompletionModal } from '../collection/CollectionCompletionModal';
import { SharedMoviePage } from '../../pages/SharedMoviePage';
import { useCinema } from '../../context/CinemaContext';

const getShareRoute = () => {
  const { hash, pathname, search } = window.location;
  if (hash.startsWith('#share-movie=') || hash.startsWith('#share-col=')) return hash;
  if (pathname.startsWith('/share/movie/')) return `#share-movie=${pathname.replace('/share/movie/', '')}${search}`;
  if (pathname.startsWith('/share/collection/')) return `#share-col=${pathname.replace('/share/collection/', '')}${search}`;
  return '';
};

/**
 * App frame. The document is the only vertical scroller: no fixed heights or
 * overflow containers here. Navigation is fixed (sidebar ≥768px, bottom bar
 * below) and the content reserves room for it.
 */
export const CinemaShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { celebrationCollection, dismissCelebrationCollection, setActiveTab } = useCinema();
  const [shareHash, setShareHash] = useState<string>(getShareRoute);

  useEffect(() => {
    const handleUrlChange = () => setShareHash(getShareRoute());
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const handleDismissShare = () => {
    setShareHash('');
    window.history.replaceState(null, '', '/');
    setActiveTab('home');
  };

  return (
    <div className="relative min-h-dvh bg-ink text-text selection:bg-gold selection:text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-full focus:bg-gold focus:text-ink focus:font-semibold"
      >
        Skip to content
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[55vh] z-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(224,173,82,0.07), transparent 70%), radial-gradient(40% 40% at 90% 20%, rgba(140,122,208,0.06), transparent 70%)',
        }}
      />

      <CinemaDesktopNav />

      <main
        id="main"
        tabIndex={-1}
        className="relative z-[1] md:pl-[var(--cinema-sidebar-width)] pb-[var(--cinema-bottom-clearance)] md:pb-16 outline-none"
      >
        <OfflineIndicator />
        <div className="mx-auto w-full max-w-[1360px] page-x pt-[calc(env(safe-area-inset-top,0px)+12px)] md:pt-8">
          {children}
        </div>
      </main>

      <CinemaMobileNav />

      {celebrationCollection && (
        <CollectionCompletionModal collection={celebrationCollection} onClose={dismissCelebrationCollection} />
      )}

      {shareHash && <SharedMoviePage hash={shareHash} onDismiss={handleDismissShare} />}

      <Toast />
    </div>
  );
};
