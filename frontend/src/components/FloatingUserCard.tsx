"use client";
import React, { useState, useRef, useEffect } from 'react';

interface FloatingUserCardProps {
  name: string;
}

export default function FloatingUserCard({ name }: FloatingUserCardProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={cardRef}
      className="fixed w-48 h-48 bg-feather-green rounded-xl flex flex-col items-center justify-center relative shadow-2xl cursor-move z-10"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-snow rounded-full flex items-center justify-center text-eel font-bold w-20 h-20 text-2xl shadow-lg">
        {getInitials(name)}
      </div>
      <div className="absolute bottom-3 left-3">
        <h3 className="text-snow font-medium text-sm drop-shadow-lg">
          {name}
        </h3>
      </div>
    </div>
  );
}
