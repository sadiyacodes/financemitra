interface AffectMeChipProps {
  onClick: () => void;
  isLoading?: boolean;
}

export default function AffectMeChip({ onClick, isLoading }: AffectMeChipProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        flex items-center gap-1.5 mt-2
        bg-teal-50 border border-teal-200 text-teal-700
        text-[13px] font-medium rounded-full px-[14px] py-[6px]
        hover:bg-teal-100 hover:border-teal-300 transition-colors
        cursor-pointer
        ${isLoading ? "opacity-70 cursor-not-allowed" : ""}
      `}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-500">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      How does this affect my budget?
    </button>
  );
}
