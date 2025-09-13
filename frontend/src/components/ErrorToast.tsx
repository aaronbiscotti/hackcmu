"use client";
import React, { useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ErrorToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export default function ErrorToast({ message, isVisible, onClose }: ErrorToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <div className={`fixed top-6 right-6 z-50 transform transition-all duration-300 ease-out ${
      isVisible 
        ? 'translate-x-0 opacity-100 scale-100' 
        : 'translate-x-full opacity-0 scale-95 pointer-events-none'
    }`}>
      <div className="bg-red-500 text-snow rounded-xl p-4 shadow-2xl border border-red-400 max-w-sm">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-snow flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-600 rounded-md transition-colors duration-200 flex-shrink-0"
          >
            <XMarkIcon className="h-4 w-4 text-snow" />
          </button>
        </div>
        <div className="mt-3 bg-red-400 h-1 rounded-full overflow-hidden">
          <div className="h-full bg-snow rounded-full animate-shrink-width" />
        </div>
      </div>
    </div>
  );
}
