// Debug logger that persists across page reloads
export const debugLog = (category: string, message: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    category,
    message,
    data,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  };
  
  // Log to console
  console.log(`[${category}] ${message}`, data || '');
  
  // Store in sessionStorage
  if (typeof window !== 'undefined') {
    const logs = JSON.parse(sessionStorage.getItem('debug_logs') || '[]');
    logs.push(logEntry);
    // Keep only last 100 entries
    if (logs.length > 100) {
      logs.shift();
    }
    sessionStorage.setItem('debug_logs', JSON.stringify(logs));
  }
};

export const getDebugLogs = () => {
  if (typeof window !== 'undefined') {
    return JSON.parse(sessionStorage.getItem('debug_logs') || '[]');
  }
  return [];
};

export const clearDebugLogs = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('debug_logs');
  }
};

// Add this to window for easy console access
if (typeof window !== 'undefined') {
  (window as Window & { getDebugLogs?: typeof getDebugLogs; clearDebugLogs?: typeof clearDebugLogs }).getDebugLogs = getDebugLogs;
  (window as Window & { getDebugLogs?: typeof getDebugLogs; clearDebugLogs?: typeof clearDebugLogs }).clearDebugLogs = clearDebugLogs;
  console.log('Debug logger ready. Use window.getDebugLogs() to see persisted logs.');
}