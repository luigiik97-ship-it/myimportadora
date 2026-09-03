import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<LogoProps> = ({ className = 'w-8 h-8', size }) => {
  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Logo M"
    >
      {/* Main Stylized 'M' */}
      <path
        d="M280 190 L130 710 L260 710 L395 670 L500 460 L605 670 L740 710 L865 710 L715 190 L500 460 Z"
        fill="currentColor"
      />
      {/* Left Eye */}
      <path
        d="M225 705 Q225 815 300 815 Q370 815 370 705 Z"
        fill="currentColor"
      />
      {/* Right Eye */}
      <path
        d="M630 705 Q630 815 700 815 Q775 815 775 705 Z"
        fill="currentColor"
      />
    </svg>
  );
};

