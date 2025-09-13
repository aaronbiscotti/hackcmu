"use client";
import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }
    if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      zIndex: 9999, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center'
    }}>
      <div
        style={{ position: 'fixed', inset: 0 }}
        onClick={onClose}
      />
      <div className={`window ${
        isClosing ? 'animate-modal-out' : 'animate-modal-in'
      }`} style={{ 
        position: 'relative',
        maxWidth: '400px',
        width: '100%',
        margin: '1rem',
        zIndex: 10000
      }}>
        <div className="title-bar">
          <div className="title-bar-text">{title || 'Dialog'}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>
        <div className="window-body" style={{ padding: '1rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
