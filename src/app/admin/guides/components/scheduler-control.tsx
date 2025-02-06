'use client';

import { useState } from 'react';

export function SchedulerControl() {
  const [message, setMessage] = useState('');

  const handleStart = async () => {
    try {
      const res = await fetch('/api/scheduler/init');
      const data = await res.json();
      setMessage(data.message || '스케줄러가 시작되었습니다.');
    } catch (error) {
      setMessage('스케줄러 시작 중 오류 발생');
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch('/api/scheduler/stop');
      const data = await res.json();
      setMessage(data.message || '스케줄러가 종료되었습니다.');
    } catch (error) {
      setMessage('스케줄러 종료 중 오류 발생');
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex space-x-4">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleStart}
        >
          스케줄러 시작
        </button>
        <button
          className="px-4 py-2 bg-red-600 text-white rounded"
          onClick={handleStop}
        >
          스케줄러 종료
        </button>
      </div>
      {message && <p className="text-gray-200">{message}</p>}
    </div>
  );
} 