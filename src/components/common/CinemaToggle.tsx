import React from 'react';

interface CinemaToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const CinemaToggle: React.FC<CinemaToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  icon,
}) => {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`flex items-center justify-between gap-4 py-3 px-3.5 rounded-xl cursor-pointer select-none transition-all duration-200 ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-white/[0.03] active:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon && (
          <div className="mt-0.5 text-[#EDC257] flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#F5F2F0] leading-snug">
            {label}
          </div>
          {description && (
            <p className="text-xs text-[#9E9DA5] leading-relaxed mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Custom Switch Track & Thumb */}
      <div
        className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-250 ease-out p-0.5 ${
          checked
            ? 'bg-[#EDC257] shadow-[0_0_12px_rgba(237,194,87,0.35)]'
            : 'bg-[#222534] border border-white/10'
        }`}
      >
        <div
          className={`w-6 h-6 rounded-full shadow-md transition-transform duration-250 ease-out ${
            checked
              ? 'translate-x-5 bg-[#09090D]'
              : 'translate-x-0 bg-[#F5F2F0]'
          }`}
        />
      </div>
    </div>
  );
};
