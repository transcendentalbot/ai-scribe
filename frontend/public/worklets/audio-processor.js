// Audio Worklet Processor for capturing raw PCM audio
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // Buffer size for chunks
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input && input[0]) {
      const inputData = input[0];
      
      // Copy input data to buffer
      for (let i = 0; i < inputData.length; i++) {
        this.buffer[this.bufferIndex++] = inputData[i];
        
        // When buffer is full, send it
        if (this.bufferIndex >= this.bufferSize) {
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send PCM data to main thread
          this.port.postMessage({
            type: 'audio',
            data: pcmData.buffer
          }, [pcmData.buffer]);
          
          // Reset buffer
          this.bufferIndex = 0;
        }
      }
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);