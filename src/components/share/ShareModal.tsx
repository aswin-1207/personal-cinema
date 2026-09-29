import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Movie, UserMovie } from '../../types/movie';
import { ShareService } from '../../services/shareService';
import { ShareCardStyle } from '../../types/share';
import { Share2, Copy, Check, Star } from 'lucide-react';
import { tmdbService } from '../../services/tmdbService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie;
  userData?: UserMovie;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, movie, userData }) => {
  const [style, setStyle] = useState<ShareCardStyle>('poster');
  const [includeStatus, setIncludeStatus] = useState<boolean>(false);
  const [includeRating, setIncludeRating] = useState<boolean>(false);
  const [includeReview, setIncludeReview] = useState<boolean>(false);

  const [shareUrl, setShareUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const payload = ShareService.buildMovieSharePayload(movie, userData, {
      includeStatus,
      includeRating,
      includeReview,
    });

    const url = ShareService.createMovieShareUrl(payload);
    setShareUrl(url);

    ShareService.generateQRCode(url).then(setQrCodeUrl);
  }, [isOpen, movie, userData, style, includeStatus, includeRating, includeReview]);

  const handleShare = async () => {
    const success = await ShareService.shareOrCopy(
      shareUrl,
      `Check out ${movie.title} on Personal Cinema`,
      `I'm tracking "${movie.title}" on Personal Cinema.`
    );
    if (!success) {
      handleCopy();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const posterImg = movie.posterPath ? tmdbService.getImageUrl(movie.posterPath, 'w500') : '';
  const backdropImg = movie.backdropPath ? tmdbService.getImageUrl(movie.backdropPath, 'w780') : '';
  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Movie" maxWidth="max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Live Card Preview */}
        <div className="flex flex-col items-center">
          <label className="text-xs uppercase tracking-wider text-cinema-subtle mb-2 font-medium self-start">
            Card Preview ({style.toUpperCase()})
          </label>

          {/* Poster Style */}
          {style === 'poster' && (
            <div className="w-full max-w-[260px] rounded-2xl overflow-hidden bg-cinema-charcoal border border-cinema-gold/30 shadow-2xl transition-all">
              <div className="aspect-[2/3] relative bg-cinema-black">
                {posterImg && <img src={posterImg} alt="" className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-cinema-black via-transparent to-transparent" />
                {includeStatus && userData?.status && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-cinema-black/80 backdrop-blur-md text-[10px] font-semibold text-cinema-gold uppercase tracking-wider border border-cinema-gold/30">
                    {userData.status.replace('_', ' ')}
                  </div>
                )}
              </div>
              <div className="p-3 text-center">
                <h4 className="font-serif font-bold text-sm text-cinema-white line-clamp-1">{movie.title}</h4>
                <p className="text-[11px] text-cinema-subtle mt-0.5">{year} {movie.runtime ? `· ${movie.runtime}m` : ''}</p>
                {includeRating && userData?.personalRating && (
                  <div className="flex items-center justify-center gap-1 mt-1 text-cinema-gold text-xs font-semibold">
                    <Star size={12} className="fill-cinema-gold" />
                    <span>{userData.personalRating.toFixed(1)} / 5</span>
                  </div>
                )}
                {includeReview && userData?.review && (
                  <p className="text-[10px] italic text-cinema-silver mt-1.5 line-clamp-2 bg-cinema-surface/50 p-1.5 rounded">
                    "{userData.review}"
                  </p>
                )}
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[9px] tracking-widest text-cinema-gold uppercase">
                  Personal Cinema
                </div>
              </div>
            </div>
          )}

          {/* Cinema Style */}
          {style === 'cinema' && (
            <div className="w-full rounded-2xl overflow-hidden bg-cinema-surface border border-cinema-gold/40 shadow-2xl relative">
              <div className="aspect-[16/9] relative bg-cinema-black">
                {backdropImg || posterImg ? (
                  <img src={backdropImg || posterImg} alt="" className="w-full h-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-cinema-surface via-cinema-surface/40 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-base text-cinema-white drop-shadow-md">{movie.title}</h4>
                    <p className="text-xs text-cinema-silver drop-shadow">{year} {movie.runtime ? `· ${movie.runtime}m` : ''}</p>
                  </div>
                  {includeRating && userData?.personalRating && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-cinema-black/80 text-cinema-gold text-xs font-bold border border-cinema-gold/40">
                      <Star size={12} className="fill-cinema-gold" />
                      <span>{userData.personalRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3">
                {includeReview && userData?.review && (
                  <p className="text-xs italic text-cinema-silver line-clamp-2 mb-2">
                    "{userData.review}"
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-cinema-subtle">
                  <span>PERSONAL CINEMA ARCHIVE</span>
                  {includeStatus && userData?.status && (
                    <span className="text-cinema-gold font-medium uppercase">{userData.status.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Minimal Style */}
          {style === 'minimal' && (
            <div className="w-full rounded-xl bg-cinema-charcoal p-4 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-cinema-black">
                  {posterImg && <img src={posterImg} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <h4 className="font-semibold text-cinema-white text-sm">{movie.title}</h4>
                  <p className="text-xs text-cinema-subtle">{year} {movie.runtime ? `· ${movie.runtime}m` : ''}</p>
                  {includeRating && userData?.personalRating && (
                    <div className="flex items-center gap-1 text-cinema-gold text-xs mt-1">
                      <Star size={11} className="fill-cinema-gold" />
                      <span>{userData.personalRating.toFixed(1)} / 5</span>
                    </div>
                  )}
                </div>
              </div>
              {includeReview && userData?.review && (
                <p className="text-xs text-cinema-silver italic mt-3 pt-2 border-t border-white/5 line-clamp-2">
                  "{userData.review}"
                </p>
              )}
            </div>
          )}

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="mt-4 flex flex-col items-center">
              <div className="p-2 rounded-xl bg-cinema-black border border-cinema-gold/20 shadow-md">
                <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 rounded" />
              </div>
              <span className="text-[10px] text-cinema-subtle mt-1">Scan with camera</span>
            </div>
          )}
        </div>

        {/* Right Column: Customization Controls */}
        <div className="space-y-5">
          {/* Card Style Selector */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-2 font-medium">
              Share Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['poster', 'cinema', 'minimal'] as ShareCardStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                    style === s
                      ? 'border-cinema-gold bg-cinema-gold/15 text-cinema-gold'
                      : 'border-white/10 bg-cinema-surface text-cinema-silver hover:border-white/20'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Toggles */}
          {userData && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-2 font-medium">
                Include in Share
              </label>
              <div className="space-y-2 bg-cinema-surface/50 p-3 rounded-xl border border-white/5">
                <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
                  <span>Watch Status ({userData.status.replace('_', ' ')})</span>
                  <input
                    type="checkbox"
                    checked={includeStatus}
                    onChange={(e) => setIncludeStatus(e.target.checked)}
                    className="cinema-checkbox"
                  />
                </label>

                {userData.personalRating !== null && userData.personalRating !== undefined && (
                  <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
                    <span>Personal Rating ({userData.personalRating} ★)</span>
                    <input
                      type="checkbox"
                      checked={includeRating}
                      onChange={(e) => setIncludeRating(e.target.checked)}
                      className="cinema-checkbox"
                    />
                  </label>
                )}

                {userData.review && (
                  <label className="flex items-center justify-between text-xs text-cinema-silver cursor-pointer">
                    <span>Personal Review</span>
                    <input
                      type="checkbox"
                      checked={includeReview}
                      onChange={(e) => setIncludeReview(e.target.checked)}
                      className="cinema-checkbox"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-white/5 space-y-2.5">
            <button
              onClick={handleShare}
              className="cinema-button-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <Share2 size={16} />
              <span>Share Card</span>
            </button>

            <button
              onClick={handleCopy}
              className="cinema-button-secondary w-full py-2.5 flex items-center justify-center gap-2 text-xs"
            >
              {copied ? <Check size={14} className="text-cinema-gold" /> : <Copy size={14} />}
              <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Share Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
