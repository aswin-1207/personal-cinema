import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CollectionWithMovies } from '../../types/collection';
import { ShareService } from '../../services/shareService';
import { useCinema } from '../../context/CinemaContext';
import {
  Share2,
  Copy,
  Check,
  CheckCircle2,
  Film,
  Mail,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

interface CollectionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionData: CollectionWithMovies;
}

export const CollectionShareModal: React.FC<CollectionShareModalProps> = ({
  isOpen,
  onClose,
  collectionData,
}) => {
  const { showToast } = useCinema();

  const [shareUrl, setShareUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const canNative = ShareService.canNativeShare();

  useEffect(() => {
    if (!isOpen) return;

    const payload = ShareService.buildCollectionSharePayload(collectionData);
    const url = ShareService.createCollectionShareUrl(payload);
    setShareUrl(url);
  }, [isOpen, collectionData]);

  const getShareText = () => {
    const isComp = collectionData.progress.isComplete;
    let text = `Check out the collection "${collectionData.collection.name}" on MyCinema.`;
    if (isComp) {
      text += ` Completed 100% (${collectionData.progress.total}/${collectionData.progress.total} titles)!`;
    } else {
      text += ` Progress: ${collectionData.progress.watched}/${collectionData.progress.total} watched (${collectionData.progress.percent}%).`;
    }
    return text;
  };

  const handleNativeShare = async () => {
    const text = getShareText();

    const result = await ShareService.share({
      title: `${collectionData.collection.name} • MyCinema Collection`,
      text,
      url: shareUrl,
    });

    if (result.outcome === 'shared') {
      showToast('Collection shared successfully!');
      onClose();
    } else if (result.outcome === 'copied') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      showToast('Link copied to clipboard!');
    }
  };

  const handleCopyLink = async () => {
    await ShareService.copyLink(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    showToast('Collection link copied to clipboard!');
  };

  const handleCopyText = async () => {
    const textWithUrl = `${getShareText()}\n\n${shareUrl}`;
    await ShareService.copyText(textWithUrl);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
    showToast('Formatted text copied to clipboard!');
  };

  const topPosters = collectionData.movies
    .map((m) => m.movie.posterPath)
    .filter(Boolean)
    .slice(0, 4);

  // Find final movie title if completed
  const finalMovie = collectionData.collection.finalMovieId
    ? collectionData.movies.find((m) => m.movie.id === collectionData.collection.finalMovieId)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Collection"
      maxWidth="max-w-xl"
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
      <div className="flex flex-col items-center text-center">
        {/* Collection Card Live Preview */}
        <div className="w-full max-w-sm rounded-2xl bg-[#131319] border border-[#E0AD52]/40 p-5 shadow-2xl relative overflow-hidden mb-5 text-left">
          {/* Completion Status Banner */}
          {collectionData.progress.isComplete && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E0AD52]/20 border border-[#E0AD52]/40 text-[#E0AD52] text-xs font-semibold w-fit mb-3">
              <CheckCircle2 size={14} />
              <span>COLLECTION COMPLETE ✓</span>
            </div>
          )}

          <h3 className="font-bold text-xl text-[#F5F3EB] mb-1">
            {collectionData.collection.name}
          </h3>
          {collectionData.collection.description && (
            <p className="text-xs text-[#9E9DA5] mb-3 line-clamp-2">
              {collectionData.collection.description}
            </p>
          )}

          {/* Progress Summary */}
          <div className="mb-3.5">
            <div className="flex justify-between text-xs text-[#9E9DA5] mb-1">
              <span>
                {collectionData.progress.watched} of {collectionData.progress.total} watched
              </span>
              <span className="font-semibold text-[#E0AD52]">{collectionData.progress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#09090B] rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-[#D99C33] to-[#E0AD52] rounded-full"
                style={{ width: `${collectionData.progress.percent}%` }}
              />
            </div>
          </div>

          {/* THE FINAL FILM Memory Card if complete */}
          {collectionData.progress.isComplete && finalMovie && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-black/40 border border-[#E0AD52]/30 flex items-center gap-3">
              <div className="w-9 h-13 rounded overflow-hidden flex-shrink-0 bg-black">
                {finalMovie.movie.posterPath ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${finalMovie.movie.posterPath}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film size={16} className="text-[#9E9DA5] m-auto" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-[#E0AD52] font-bold">
                  The Final Film
                </div>
                <div className="text-xs font-semibold text-[#F5F3EB] truncate">
                  {finalMovie.movie.title}
                </div>
                {collectionData.collection.completedAt && (
                  <div className="text-[10px] text-[#9E9DA5]">
                    Completed {new Date(collectionData.collection.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Poster Collage Preview */}
          {topPosters.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3.5">
              {topPosters.map((path, i) => (
                <img
                  key={i}
                  src={`https://image.tmdb.org/t/p/w185${path}`}
                  alt=""
                  className="aspect-[2/3] object-cover rounded-lg shadow border border-white/5"
                />
              ))}
            </div>
          )}

          <div className="text-[10px] tracking-wider text-[#9E9DA5] uppercase border-t border-white/5 pt-2 flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-bold text-[#E0AD52]">
              <BrandLogo variant="symbol" size={13} alt="MYCINEMA" />
              <span>MYCINEMA</span>
            </div>
            <span>Collection</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full max-w-sm space-y-2.5">
          <button
            onClick={handleNativeShare}
            className="cinema-button-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold min-h-[44px] cursor-pointer shadow-gold"
          >
            <Share2 size={16} />
            <span>{canNative ? 'Share via Native Apps' : 'Share Collection'}</span>
          </button>

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

          {/* Direct Fallback Links */}
          <div className="flex items-center justify-center gap-2 pt-1">


            <a
              href={ShareService.getEmailUrl(
                `Collection: ${collectionData.collection.name}`,
                getShareText(),
                shareUrl
              )}
              className="py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9E9DA5] hover:text-[#F5F3EB] text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[40px]"
              title="Share via Email"
            >
              <Mail size={14} />
              <span>Email</span>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
};
