import React from 'react';
import { ChevronDown } from 'lucide-react';

export const ScrollIndicator: React.FC = () => {
  const scrollToAnalytics = () => {
    const el = document.getElementById('analytics');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToAnalytics}
      className="group flex flex-col items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors duration-200 pointer-events-auto select-none focus:outline-none"
      aria-label="Scroll to booking calendar"
      title="Booking calendar"
    >
      <ChevronDown className="w-4 h-4 mt-0.5 animate-bounce text-cyan-400/80 group-hover:text-cyan-300" />
    </button>
  );
};
