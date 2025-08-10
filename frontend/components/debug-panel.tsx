'use client';

import { useState, useEffect } from 'react';
import { getDebugLogs, clearDebugLogs } from '@/utils/debug-logger';

interface DebugLog {
  timestamp: string;
  category: string;
  message: string;
  data?: unknown;
  url: string;
}

export function DebugPanel() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(getDebugLogs());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      >
        Debug ({logs.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
        <h3 className="font-semibold">Debug Logs</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              clearDebugLogs();
              setLogs([]);
            }}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-600 hover:text-gray-800"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="overflow-y-auto max-h-80 p-4 text-xs">
        {logs.length === 0 ? (
          <p className="text-gray-500">No logs yet...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-gray-200">
              <div className="flex justify-between">
                <span className="font-semibold text-blue-600">[{log.category}]</span>
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-gray-700">{log.message}</div>
              {!!log.data && (
                <pre className="mt-1 text-gray-600 overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
              <div className="text-gray-400 mt-1">{log.url}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}