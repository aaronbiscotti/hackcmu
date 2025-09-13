"use client";
import React from 'react';
import Modal from './Modal';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ExitConfirmationModal({ isOpen, onClose, onConfirm }: ExitConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="End Call">
      <div className="text-center">
        <p className="text-eel/70 mb-8">
          Are you sure you want to end this call? You'll be taken to the post-call summary.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-eel font-medium py-3 px-6 rounded-xl hover:bg-gray-300 transition-colors duration-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-snow font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors duration-300"
          >
            End Call
          </button>
        </div>
      </div>
    </Modal>
  );
}
