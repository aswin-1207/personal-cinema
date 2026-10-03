import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Movie, UserMovie } from '../../types/movie';
import { ShareService } from '../../services/shareService';
import { ShareCardStyle } from '../../types/share';
import { tmdbService } from '../../services/tmdbService';
import { useCinema } from '../../context/CinemaContext';
import {
  Share2,
  Copy,
  Check,
  Star,
  Download,
  MessageCircle,
  Send,
  Mail,
  Sparkles,
  Eye,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie;
  userData?: UserMovie;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, movie, userData }) => {
  const { showToast } = useCinema();

  const [style, setStyle] = useState<ShareCardStyle>('poster');
  const [includeStatus, setIncludeStatus] = useState<boolean>(false);
  const [includeRating, setIncludeRating] = useState<boolean>(false);
  const [includeReview, setIncludeReview] = useState<boolean>(false);

  const [shareUrl, setShareUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);

  const canNative = ShareService.canNativeShare();

  useEffect(() => {
    if (!isOpen) return;

    const payload = ShareService.buildMovieSharePayload(movie, userData, {
      includeStatus,
      includeRating,
      includeReview,
    });

    const url = ShareService.createMovieShareUrl(payload);
    setShareUrl(url);
  }, [isOpen, movie, userData, style, includeStatus, includeRating, includeReview]);

  const getShareText = () => {
    let text = `Check out "${movie.title}" on MyCinema.`;
    if (includeRating && userData?.personalRating) {
      text += ` I rated it ${userData.personalRating.toFixed(1)} / 5 stars.`;
    } else if (includeStatus && userData?.status) {
      text += ` Status: ${userData.status.replace('_', ' ')}.`;
    }
    if (includeReview && userData?.review) {
      text += ` "${userData.review}"`;
    }
    return text;
  };

  const handleNativeShare = async () => {
    const payload = ShareService.buildMovieSharePayload(movie, userData, {
      includeStatus,
      includeRating,
      includeReview,
    });

    const text = getShareText();

    // Check if we can share with image file
    let shareFiles: File[] | undefined = undefined;
    if (ShareService.canShareFiles()) {
      try {
        const blob = await ShareService.generateMovieCardBlob(payload, style);
        if (blob) {
          shareFiles = [new File([blob], `${movie.title.replace(/[^a-z0-9]/gi, '_')}_card.png`, { type: 'image/png' })];
        }
      } catch {
        // Fall back to link share
      }
    }

    const result = await ShareService.share({
      title: `${movie.title} • MyCinema`,
      text,
      url: shareUrl,
      files: shareFiles,
    });

    if (result.outcome === 'shared') {
      showToast('Shared successfully!');
      onClose();
    } else if (result.outcome === 'copied') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      showToast('Link copied to clipboard!');
    }
    // 'cancelled' outcome deliberately does not trigger error toast
  };

  const handleCopyLink = async () => {
    await ShareService.copyLink(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    showToast('Link copied to clipboard!');
  };

  const handleCopyText = async () => {
    const textWithUrl = `${getShareText()}\n\n${shareUrl}`;
    await ShareService.copyText(textWithUrl);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
    showToast('Formatted text copied to clipboard!');
  };

  const handleDownloadImage = async () => {
    try {
      setIsGeneratingImage(true);
      const payload = ShareService.buildMovieSharePayload(movie, userData, {
        includeStatus,
        includeRating,
        includeReview,
      });
      const blob = await ShareService.generateMovieCardBlob(payload, style);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${movie.title.replace(/[^a-z0-9]/gi, '_')}_MyCinema.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Share image downloaded!');
      }
    } catch {
      showToast('Could not generate image.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const posterImg = movie.posterPath ? tmdbService.getImageUrl(movie.posterPath, 'w500') : '';
  const backdropImg = movie.backdropPath ? tmdbService.getImageUrl(movie.backdropPath, 'w780') : '';
  const year = movie.releaseDate ? movie.releaseDate.substring(0, 4) : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Movie"
      maxWidth="max-w-2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="cinema-button-secondary px-5 py-2 text-xs font-semibold cursor-pointer"
        >
          Close
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {/* Left Column: Live Card Preview */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-2">
            <label className="text-xs uppercase tracking-wider text-cinema-subtle font-medium flex items-center gap-1.5">
              <Eye size={12} className="text-[#E0AD52]" />
              <span>Preview ({style.toUpperCase()})</span>
            </label>
            <span className="text-[10px] text-[#9E9DA5] uppercase tracking-wider font-semibold">
              Live Card
            </span>
          </div>

          {/* POSTER STYLE */}
          {style === 'poster' && (
            <div className="w-full max-w-[260px] rounded-2xl overflow-hidden bg-[#131319] border border-[#E0AD52]/40 shadow-2xl transition-all relative">
              <div className="aspect-[2/3] relative bg-[#09090B]">
                {posterImg ? (
                  <img src={posterImg} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#9E9DA5]">
                    No poster
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#131319] via-transparent to-transparent" />
                {includeStatus && userData?.status && (
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-[#09090B]/85 backdrop-blur-md text-[10px] font-semibold text-[#E0AD52] uppercase tracking-wider border border-[#E0AD52]/40 shadow">
                    {userData.status.replace('_', ' ')}
                  </div>
                )}
              </div>
              <div className="p-3.5 text-center">
                <h4 className="font-semibold text-sm text-[#F5F3EB] line-clamp-2 break-words" title={movie.title}>
                  {movie.title}
                </h4>
                <p className="text-[11px] text-[#9E9DA5] mt-0.5">
                  {year} {movie.runtime ? `· ${movie.runtime}m` : ''}
                </p>
                {includeRating && userData?.personalRating && (
                  <div className="flex items-center justify-center gap-1 mt-1.5 text-[#E0AD52] text-xs font-semibold">
                    <Star size={12} className="fill-[#E0AD52]" />
                    <span>{userData.personalRating.toFixed(1)} / 5</span>
                  </div>
                )}
                {includeReview && userData?.review && (
                  <p className="text-[10px] italic text-[#B7B5B3] mt-2 line-clamp-2 bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                    "{userData.review}"
                  </p>
                )}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-center gap-1 text-[9px] tracking-widest text-[#E0AD52] uppercase font-bold">
                  <Sparkles size={10} />
                  <span>MYCINEMA</span>
                </div>
              </div>
            </div>
          )}

          {/* CINEMA STYLE */}
          {style === 'cinema' && (
            <div className="w-full rounded-2xl overflow-hidden bg-[#131319] border border-[#E0AD52]/40 shadow-2xl relative">
              <div className="aspect-[16/9] relative bg-[#09090B]">
                {backdropImg || posterImg ? (
                  <img src={backdropImg || posterImg} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#9E9DA5]">
                    No backdrop
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#131319] via-[#131319]/40 to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-base text-[#F5F3EB] drop-shadow-md line-clamp-2 break-words" title={movie.title}>
                      {movie.title}
                    </h4>
                    <p className="text-xs text-[#9E9DA5] drop-shadow">
                      {year} {movie.runtime ? `· ${movie.runtime}m` : ''}
                    </p>
                  </div>
                  {includeRating && userData?.personalRating && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#09090B]/90 text-[#E0AD52] text-xs font-bold border border-[#E0AD52]/40 flex-shrink-0 shadow">
                      <Star size={12} className="fill-[#E0AD52]" />
                      <span>{userData.personalRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3.5">
                {includeReview && userData?.review && (
                  <p className="text-xs italic text-[#B7B5B3] line-clamp-2 mb-2.5 bg-black/40 p-2 rounded-lg border border-white/5 break-words">
                    "{userData.review}"
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-[#9E9DA5] pt-1 border-t border-white/5">
                  <span className="font-bold tracking-wider text-[#E0AD52]">MYCINEMA</span>
                  {includeStatus && userData?.status && (
                    <span className="text-[#E0AD52] font-semibold uppercase">
                      {userData.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MINIMAL STYLE */}
          {style === 'minimal' && (
            <div className="w-full rounded-2xl bg-[#131319] p-4 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-14 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#09090B] border border-white/10">
                  {posterImg ? (
                    <img src={posterImg} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-[#9E9DA5]">
                      Poster
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h4 className="font-semibold text-[#F5F3EB] text-sm line-clamp-2 break-words" title={movie.title}>
                    {movie.title}
                  </h4>
                  <p className="text-xs text-[#9E9DA5] mt-0.5">
                    {year} {movie.runtime ? `· ${movie.runtime}m` : ''}
                  </p>
                  {includeRating && userData?.personalRating && (
                    <div className="flex items-center gap-1 text-[#E0AD52] text-xs font-semibold mt-1">
                      <Star size={11} className="fill-[#E0AD52]" />
                      <span>{userData.personalRating.toFixed(1)} / 5</span>
                    </div>
                  )}
                  {includeStatus && userData?.status && (
                    <div className="text-[10px] text-[#E0AD52] font-semibold uppercase mt-1">
                      {userData.status.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
              {includeReview && userData?.review && (
                <p className="text-xs text-[#B7B5B3] italic mt-3 pt-2.5 border-t border-white/5 line-clamp-2 text-left">
                  "{userData.review}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Customization & Actions */}
        <div className="space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Style Selector */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-cinema-subtle mb-2 font-medium">
                Card Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['poster', 'cinema', 'minimal'] as ShareCardStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all min-h-[44px] cursor-pointer ${
                      style === s
                        ? 'border-[#E0AD52] bg-[#E0AD52]/15 text-[#E0AD52] font-semibold shadow'
                        : 'border-white/10 bg-[#131319] text-[#9E9DA5] hover:border-white/20'
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
                  Privacy Controls
                </label>
                <div className="space-y-2.5 bg-[#131319] p-3.5 rounded-2xl border border-white/5">
                  <label className="flex items-center justify-between text-xs text-[#F5F3EB] cursor-pointer min-h-[36px]">
                    <div>
                      <span>Watch Status</span>
                      <span className="block text-[10px] text-[#9E9DA5]">
                        ({userData.status.replace('_', ' ')})
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeStatus}
                      onChange={(e) => setIncludeStatus(e.target.checked)}
                      className="cinema-checkbox"
                    />
                  </label>

                  {userData.personalRating !== null && userData.personalRating !== undefined && (
                    <label className="flex items-center justify-between text-xs text-[#F5F3EB] cursor-pointer min-h-[36px]">
                      <div>
                        <span>Personal Rating</span>
                        <span className="block text-[10px] text-[#9E9DA5]">
                          ({userData.personalRating.toFixed(1)} ★)
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeRating}
                        onChange={(e) => setIncludeRating(e.target.checked)}
                        className="cinema-checkbox"
                      />
                    </label>
                  )}

                  {userData.review && (
                    <label className="flex items-center justify-between text-xs text-[#F5F3EB] cursor-pointer min-h-[36px]">
                      <div>
                        <span>Personal Review</span>
                        <span className="block text-[10px] text-[#9E9DA5] truncate max-w-[180px]">
                          "{userData.review}"
                        </span>
                      </div>
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
          </div>

          {/* Action CTAs */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            {/* Primary Action: Native OS Share Sheet */}
            <button
              onClick={handleNativeShare}
              className="cinema-button-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold min-h-[44px] cursor-pointer shadow-gold"
            >
              <Share2 size={16} />
              <span>{canNative ? 'Share via Native Apps' : 'Share Movie'}</span>
            </button>

            {/* Copy Link & Copy Text */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="cinema-button-secondary py-2.5 flex items-center justify-center gap-1.5 text-xs min-h-[44px] cursor-pointer"
              >
                {copiedLink ? <Check size={14} className="text-[#E0AD52]" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleCopyText}
                className="cinema-button-secondary py-2.5 flex items-center justify-center gap-1.5 text-xs min-h-[44px] cursor-pointer"
              >
                {copiedText ? <Check size={14} className="text-[#E0AD52]" /> : <Copy size={14} />}
                <span>{copiedText ? 'Text Copied!' : 'Copy Text'}</span>
              </button>
            </div>

            {/* Direct Messaging Fallbacks & Image Download */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <button
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex-1 py-2 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9E9DA5] hover:text-[#F5F3EB] text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[40px] cursor-pointer"
                title="Download share card image"
              >
                <Download size={13} />
                <span>Save Card</span>
              </button>

              <a
                href={ShareService.getWhatsAppUrl(getShareText(), shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-emerald-950/40 hover:text-emerald-400 text-[#9E9DA5] text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[40px]"
                title="Share via WhatsApp web"
              >
                <MessageCircle size={14} />
              </a>

              <a
                href={ShareService.getTelegramUrl(getShareText(), shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-sky-950/40 hover:text-sky-400 text-[#9E9DA5] text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[40px]"
                title="Share via Telegram"
              >
                <Send size={14} />
              </a>

              <a
                href={ShareService.getEmailUrl(`Check out ${movie.title} on MyCinema`, getShareText(), shareUrl)}
                className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9E9DA5] hover:text-[#F5F3EB] text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[40px]"
                title="Share via Email"
              >
                <Mail size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
