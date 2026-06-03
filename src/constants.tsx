import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export const KickIcon = ({ className, size = 24, ...props }: IconProps) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Kick Logo - Chunky Pixel K with 2 Steps (Precise) */}
    <path d="M2 2h7v6h5V2h8v8h-6v4h6v8h-8v-6h-5v6H2V2z" />
  </svg>
);

export const TikTokIcon = ({ className, size = 24, ...props }: IconProps) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* TikTok Logo - Musical Note */}
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-3.49 3.03-6.41 6.51-6.58 1.15-.04 2.29.22 3.3.77-.01 1.13-.01 2.25-.01 3.38-.78-.36-1.63-.52-2.48-.47-1.74.02-3.46 1.12-4.04 2.75-.44 1.22-.31 2.59.34 3.7.61 1.05 1.72 1.73 2.93 1.83 1.48.11 2.98-.6 3.73-1.88.42-.7.65-1.51.64-2.32-.03-4.66-.01-9.32-.02-13.99z" />
  </svg>
);

export const OBSIcon = ({ className, size = 24, ...props }: IconProps) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* OBS Studio Logo - 3 Swirl Swoosh design */}
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <path d="M12.1 12.1c3.5.5 6-2 7-5.5-1.5 3-4.5 5-7 5.5z" />
    <path d="M12.1 12.1c3.5.5 6-2 7-5.5-1.5 3-4.5 5-7 5.5z" transform="rotate(120 12 12)" />
    <path d="M12.1 12.1c3.5.5 6-2 7-5.5-1.5 3-4.5 5-7 5.5z" transform="rotate(240 12 12)" />
  </svg>
);

