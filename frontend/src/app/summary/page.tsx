"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import SummaryScreen from '../../components/SummaryScreen';

export default function SummaryPage() {
  const router = useRouter();

  const handleRestart = () => {
    router.push('/');
  };

  return (
    <main>
      <SummaryScreen onRestart={handleRestart} />
    </main>
  );
}
