"use client";
import React, { useState, useEffect } from 'react';

export default function TimeDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="text-right text-eel">
      <div className="text-lg font-normal flex items-center justify-end gap-2">
        <span>{formatTime(currentTime)}</span>
        <span>•</span>
        <span>{formatDate(currentTime)}</span>
      </div>
    </div>
  );
}
