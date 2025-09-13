"use client";
import React from 'react';

interface UserCardProps {
  name: string;
  isFullHeight?: boolean;
}

export default function UserCard({ name, isFullHeight = true }: UserCardProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`bg-feather-green flex flex-col items-center justify-center relative p-8 ${
      isFullHeight ? 'h-full' : 'aspect-square'
    }`}>
      <div className="bg-snow flex items-center justify-center text-eel font-bold w-32 h-32 text-4xl">
        {getInitials(name)}
      </div>
      <div className="absolute bottom-6 left-6">
        <h3 className="text-snow font-medium text-xl drop-shadow-lg">
          {name}
        </h3>
      </div>
    </div>
  );
}
