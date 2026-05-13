import React from 'react';

export default function Skeleton({ className = '', width, height, circle = false, ...props }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`animate-pulse bg-gray-200 ${circle ? 'rounded-full' : 'rounded-md'} ${className}`}
      style={style}
      {...props}
    />
  );
}
