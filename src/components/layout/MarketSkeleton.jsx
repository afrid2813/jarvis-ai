import React from 'react';

export default function MarketSkeleton() {
  return (
    <div className="skeleton-wrap">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </div>
  );
}
