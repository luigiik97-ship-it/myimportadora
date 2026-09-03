import React from 'react';

interface ClassicStarProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  fill?: string;
}

export const ClassicStar: React.FC<ClassicStarProps> = ({ className = 'w-4 h-4', fill, ...props }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill || 'currentColor'}
      stroke="none"
      className={`inline-block shrink-0 ${className}`}
      {...props}
    >
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
};

export default ClassicStar;
