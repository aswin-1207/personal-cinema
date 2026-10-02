import React, { useState, useEffect, useMemo } from 'react';
import { useCinema } from '../context/CinemaContext';
import { ReviewRepository } from '../db/repositories/reviewRepository';
import { MovieWithUserData } from '../types/movie';
import { ReviewCard } from '../components/review/ReviewCard';
import { ReviewDetailModal } from '../components/review/ReviewDetailModal';
import { ReviewEditorModal } from '../components/review/ReviewEditorModal';
import { ReviewShareModal } from '../components/review/ReviewShareModal';
import { EmptyState } from '../components/common/EmptyState';
import {
  BookOpen,
  Search,
  ArrowUpDown,
  ChevronLeft,
  PenTool,
} from 'lucide-react';

export const ReviewsPage: React.FC = () => {
  const { setActiveTab, dataVersion } = useCinema();

  const [items, setItems] = useState<MovieWithUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'reviewed' | 'rated' | 'favorites'>('all');
  const [sortBy, setSortBy] = useState<'recent_reviewed' | 'recent_watched' | 'highest_rated' | 'lowest_rated' | 'title'>('recent_reviewed');

  // Modal states
  const [selectedItem, setSelectedItem] = useState<MovieWithUserData | null>(null);
  const [editingItem, setEditingItem] = useState<MovieWithUserData | null>(null);
  const [sharingItem, setSharingItem] = useState<MovieWithUserData | null>(null);

  useEffect(() => {
    let isMounted = true;
    ReviewRepository.getAllJournalEntries().then((entries) => {
      if (!isMounted) return;
      setItems(entries);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [dataVersion]);

  // Keep selected item synced if data updates
  useEffect(() => {
    if (selectedItem) {
      const refreshed = items.find((it) => it.movie.id === selectedItem.movie.id);
      if (refreshed) setSelectedItem(refreshed);
    }
  }, [items]);

  // Filtering & Sorting
  const filteredAndSortedItems = useMemo(() => {
    let result = items;

    // Filter by type
    if (activeFilter === 'reviewed') {
      result = result.filter((it) => Boolean(it.userData?.review && it.userData.review.trim().length > 0));
    } else if (activeFilter === 'rated') {
      result = result.filter((it) => typeof it.userData?.personalRating === 'number');
    } else if (activeFilter === 'favorites') {
      result = result.filter((it) => it.userData?.isFavorite);
    }

    // Search by title OR review text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((it) => {
        const titleMatch =
          it.movie.title.toLowerCase().includes(q) ||
          Boolean(it.movie.originalTitle && it.movie.originalTitle.toLowerCase().includes(q));
        const reviewText = it.userData?.review || '';
        const reviewTitle = it.userData?.reviewTitle || '';
        const textMatch =
          reviewText.toLowerCase().includes(q) || reviewTitle.toLowerCase().includes(q);
        return titleMatch || textMatch;
      });
    }

    // Sorting
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'recent_reviewed': {
          const dateA = a.userData?.reviewedAt || a.userData?.watchedAt || a.userData?.addedAt || '';
          const dateB = b.userData?.reviewedAt || b.userData?.watchedAt || b.userData?.addedAt || '';
          return dateB.localeCompare(dateA);
        }
        case 'recent_watched': {
          const dateA = a.userData?.watchedAt || a.userData?.addedAt || '';
          const dateB = b.userData?.watchedAt || b.userData?.addedAt || '';
          return dateB.localeCompare(dateA);
        }
        case 'highest_rated': {
          const rA = a.userData?.personalRating ?? -1;
          const rB = b.userData?.personalRating ?? -1;
          return rB - rA;
        }
        case 'lowest_rated': {
          const rA = a.userData?.personalRating ?? 99;
          const rB = b.userData?.personalRating ?? 99;
          return rA - rB;
        }
        case 'title':
          return a.movie.title.localeCompare(b.movie.title);
        default:
          return 0;
      }
    });
  }, [items, activeFilter, searchQuery, sortBy]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      reviewed: items.filter((it) => Boolean(it.userData?.review && it.userData.review.trim().length > 0)).length,
      rated: items.filter((it) => typeof it.userData?.personalRating === 'number').length,
      favorites: items.filter((it) => it.userData?.isFavorite).length,
    };
  }, [items]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-cinema-fade pb-16">
      {/* Page Header with Return to Profile Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <button
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-1.5 text-xs text-[#9E9DA5] hover:text-[#E0AD52] transition-colors mb-2 bg-transparent border-none p-0 cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>Profile & Settings</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#F5F3EB] tracking-tight">
              Film Journal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E0AD52]/15 text-[#E0AD52] border border-[#E0AD52]/20 font-mono">
              {counts.all} {counts.all === 1 ? 'film' : 'films'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#9E9DA5] mt-1">
            Your private repository of written reflections and scores.
          </p>
        </div>

        {/* Quick Navigate to Watched */}
        <button
          onClick={() => setActiveTab('watched')}
          className="cinema-button-secondary px-4 py-2.5 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto"
        >
          <PenTool size={13} className="text-[#E0AD52]" />
          <span>Write from Watched Films</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#63626B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search film title or review text..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#131319] border border-white/10 text-xs text-[#F5F3EB] placeholder-[#63626B] focus:border-[#E0AD52] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#9E9DA5] hover:text-[#F5F3EB] bg-transparent border-none cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <ArrowUpDown size={14} className="text-[#63626B] flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-[#131319] border border-white/10 text-xs text-[#F5F3EB] focus:border-[#E0AD52] focus:outline-none cursor-pointer"
          >
            <option value="recent_reviewed">Recently Reviewed</option>
            <option value="recent_watched">Recently Watched</option>
            <option value="highest_rated">Highest Rated</option>
            <option value="lowest_rated">Lowest Rated</option>
            <option value="title">Film Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'All Entries', count: counts.all },
          { id: 'reviewed', label: 'Written Reviews', count: counts.reviewed },
          { id: 'rated', label: 'Rated Films', count: counts.rated },
          { id: 'favorites', label: 'Favorites', count: counts.favorites },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#E0AD52]/15 text-[#E0AD52] border-[#E0AD52]/40 shadow-sm'
                  : 'bg-[#131319]/80 text-[#9E9DA5] border-white/[0.06] hover:text-[#F5F3EB] hover:bg-[#181822]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono ${isActive ? 'text-[#E0AD52]' : 'text-[#63626B]'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#E0AD52]/20 border-t-[#E0AD52] animate-spin" />
          <span className="text-xs uppercase tracking-widest text-[#63626B] font-mono">
            Opening Film Journal
          </span>
        </div>
      ) : filteredAndSortedItems.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="NO REVIEWS YET"
            description="Watch something. Then write what you thought."
            actionLabel="EXPLORE MOVIES"
            onAction={() => setActiveTab('discover')}
          />
        ) : (
          <div className="p-8 rounded-2xl bg-[#131319]/60 border border-white/[0.06] text-center space-y-2">
            <h3 className="font-serif font-bold text-base text-[#F5F3EB]">No Matching Journal Entries</h3>
            <p className="text-xs text-[#9E9DA5]">
              No entries matched your current search or filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="cinema-button-secondary px-3.5 py-1.5 text-xs font-semibold mt-2"
            >
              Clear Filters
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredAndSortedItems.map((item) => (
            <ReviewCard
              key={item.movie.id}
              item={item}
              onOpenDetail={() => setSelectedItem(item)}
              onEdit={() => setEditingItem(item)}
            />
          ))}
        </div>
      )}

      {/* Review Detail Modal */}
      {selectedItem && (
        <ReviewDetailModal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onEdit={() => {
            const it = selectedItem;
            setSelectedItem(null);
            setEditingItem(it);
          }}
          onShare={() => {
            const it = selectedItem;
            setSharingItem(it);
          }}
          onDeleted={() => {
            setSelectedItem(null);
          }}
        />
      )}

      {/* Review Editor Modal */}
      {editingItem && (
        <ReviewEditorModal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          movie={editingItem.movie}
          initialUserData={editingItem.userData}
          onSaved={() => {
            setEditingItem(null);
          }}
        />
      )}

      {/* Review Share Modal */}
      {sharingItem && (
        <ReviewShareModal
          isOpen={Boolean(sharingItem)}
          onClose={() => setSharingItem(null)}
          item={sharingItem}
        />
      )}
    </div>
  );
};
