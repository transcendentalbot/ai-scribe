/**
 * Debug utilities for audio playback issues
 */

export interface AudioDebugInfo {
  recordingId: string;
  url: string;
  browserSupport: {
    webm: string;
    webmOpus: string;
    ogg: string;
    oggOpus: string;
    mp4: string;
  };
  urlTest: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  fileAnalysis?: {
    size: number;
    type: string;
    signature?: string;
  };
}

export async function debugAudioPlayback(recording: any): Promise<AudioDebugInfo> {
  const audio = new Audio();
  
  // Check browser support
  const browserSupport = {
    webm: audio.canPlayType('audio/webm'),
    webmOpus: audio.canPlayType('audio/webm;codecs=opus'),
    ogg: audio.canPlayType('audio/ogg'),
    oggOpus: audio.canPlayType('audio/ogg;codecs=opus'),
    mp4: audio.canPlayType('audio/mp4'),
  };
  
  // Test URL
  let urlTest: AudioDebugInfo['urlTest'] = {};
  try {
    const response = await fetch(recording.url, { 
      method: 'HEAD',
      mode: 'cors',
    });
    
    urlTest = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    urlTest.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  // Try to analyze file
  let fileAnalysis: AudioDebugInfo['fileAnalysis'];
  try {
    const response = await fetch(recording.url, {
      headers: {
        'Range': 'bytes=0-1024'
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      fileAnalysis = {
        size: parseInt(response.headers.get('content-length') || '0'),
        type: blob.type,
        signature: Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      };
    }
  } catch (error) {
    console.error('File analysis failed:', error);
  }
  
  return {
    recordingId: recording.id,
    url: recording.url,
    browserSupport,
    urlTest,
    fileAnalysis,
  };
}

export function logDebugInfo(info: AudioDebugInfo) {
  console.group('🔍 Audio Debug Info for Recording:', info.recordingId);
  
  console.log('🌐 Browser Support:');
  console.table(info.browserSupport);
  
  console.log('📡 URL Test:');
  if (info.urlTest.error) {
    console.error('Failed to access URL:', info.urlTest.error);
  } else {
    console.log('Status:', info.urlTest.status, info.urlTest.statusText);
    console.log('Headers:', info.urlTest.headers);
  }
  
  if (info.fileAnalysis) {
    console.log('📄 File Analysis:');
    console.log('Size:', info.fileAnalysis.size, 'bytes');
    console.log('Type:', info.fileAnalysis.type);
    console.log('Signature:', info.fileAnalysis.signature);
    
    // Check file signature
    if (info.fileAnalysis.signature === '1a 45 df a3') {
      console.log('✅ Valid WebM signature detected');
    } else if (info.fileAnalysis.signature === '4f 67 67 53') {
      console.log('✅ Valid Ogg signature detected');
    } else {
      console.warn('⚠️ Unknown file signature');
    }
  }
  
  console.groupEnd();
}