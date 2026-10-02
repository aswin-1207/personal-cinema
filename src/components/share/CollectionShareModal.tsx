import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { CollectionWithMovies } from '../../types/collection';
import { ShareService } from '../../services/shareService';
import { Share2, Copy, Check, CheckCircle2 } from 'lucide-react';

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
  const [shareUrl, setShareUrl] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const payload = ShareService.buildCollectionSharePayload(collectionData);
    const url = ShareService.createCollectionShareUrl(payload);
    setShareUrl(url);

    ShareService.generateQRCode(url).then(setQrCodeUrl);
  }, [isOpen, collectionData]);

  const handleShare = async () => {
    const success = await ShareService.shareOrCopy(
      shareUrl,
      `Check out "${collectionData.collection.name}" on MyCinema`,
      `Explore this curated collection: ${collectionData.collection.name} (${collectionData.progress.percent}% watched).`
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

  const topPosters = collectionData.movies
    .map((m) => m.movie.posterPath)
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Collection" maxWidth="max-w-xl">
      <div className="flex flex-col items-center text-center">
        {/* Collection Card Preview */}
        <div className="w-full max-w-sm rounded-2xl bg-cinema-surface border border-cinema-gold/30 p-5 shadow-2xl relative overflow-hidden mb-6 text-left">
          {collectionData.progress.isComplete && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cinema-gold/20 border border-cinema-gold/40 text-cinema-gold text-xs font-semibold w-fit mb-3">
              <CheckCircle2 size={14} />
              <span>100% Completed</span>
            </div>
          )}

          <h3 className="font-serif font-bold text-xl text-cinema-white mb-1">
            {collectionData.collection.name}
          </h3>
          {collectionData.collection.description && (
            <p className="text-xs text-cinema-subtle mb-3 line-clamp-2">
              {collectionData.collection.description}
            </p>
          )}

          {/* Progress summary */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-cinema-silver mb-1">
              <span>{collectionData.progress.watched} of {collectionData.progress.total} watched</span>
              <span className="font-semibold text-cinema-gold">{collectionData.progress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-cinema-charcoal rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cinema-amber to-cinema-gold rounded-full"
                style={{ width: `${collectionData.progress.percent}%` }}
              />
            </div>
          </div>

          {/* Poster Collage preview */}
          {topPosters.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {topPosters.map((path, i) => (
                <img
                  key={i}
                  src={`https://image.tmdb.org/t/p/w185${path}`}
                  alt=""
                  className="aspect-[2/3] object-cover rounded shadow"
                />
              ))}
            </div>
          )}

          <div className="text-[10px] tracking-wider text-cinema-subtle uppercase border-t border-white/5 pt-2 flex justify-between">
            <span className="font-bold text-[#E0AD52]">MyCinema Collection</span>
            <span>Curated Library</span>
          </div>
        </div>

        {/* QR Code */}
        {qrCodeUrl && (
          <div className="flex flex-col items-center mb-6">
            <div className="p-2 rounded-xl bg-cinema-black border border-cinema-gold/30 shadow-lg">
              <img src={qrCodeUrl} alt="QR Code" className="w-28 h-28 rounded" />
            </div>
            <span className="text-[11px] text-cinema-subtle mt-1.5">Scan to view collection</span>
          </div>
        )}

        {/* Actions */}
        <div className="w-full max-w-sm space-y-2.5">
          <button
            onClick={handleShare}
            className="cinema-button-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Share2 size={16} />
            <span>Share Collection</span>
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
    </Modal>
  );
};
