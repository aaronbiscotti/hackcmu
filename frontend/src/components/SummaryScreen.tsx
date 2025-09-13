// src/components/SummaryScreen.tsx
"use client";
import React from 'react';

const MetricCard = ({ title, value, recommendation }: { title: string, value: string, recommendation: string }) => (
  <div className="bg-gray-100 p-4 rounded-xl">
    <h3 className="font-bold text-eel">{title}</h3>
    <p className="text-2xl font-bold text-feather-green">{value}</p>
    <p className="text-sm text-eel/60">{recommendation}</p>
  </div>
);

export default function SummaryScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="bg-snow min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-100 w-full max-w-2xl p-8 rounded-xl text-center">
        <h1 className="text-3xl font-bold text-eel mb-6">Post Game Summary</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <MetricCard title="Speed" value="150 WPM" recommendation="Slightly fast. Try pausing between key points." />
          <MetricCard title="Clarity" value="Good" recommendation="Your articulation was clear and consistent." />
          <MetricCard title="Filler Words" value="8 words" recommendation="Used 'um' and 'like' occasionally." />
          <MetricCard title="Inflection" value="Dynamic" recommendation="Great vocal variety kept the talk engaging." />
          <MetricCard title="Volume" value="Consistent" recommendation="Your volume was steady and easy to hear." />
        </div>
        <button
          onClick={onRestart}
          className="mt-8 bg-feather-green text-snow font-bold py-3 px-6 rounded-xl hover:bg-mask-green transition-colors duration-300"
        >
          Start Another Call
        </button>
      </div>
    </div>
  );
}
