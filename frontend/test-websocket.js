const WebSocket = require('ws');

const ws = new WebSocket('wss://wrm0igv0bd.execute-api.us-east-1.amazonaws.com/prod');

ws.on('open', function open() {
  console.log('Connected to WebSocket');
  
  // Send test message
  ws.send(JSON.stringify({
    action: 'audio-stream',
    type: 'start-recording',
    encounterId: 'test-123',
    metadata: {
      sampleRate: 48000,
      channels: 1,
      codec: 'audio/webm;codecs=opus',
    },
  }));
});

ws.on('message', function message(data) {
  console.log('Received:', data.toString());
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('Disconnected from WebSocket');
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 5000);
EOF < /dev/null