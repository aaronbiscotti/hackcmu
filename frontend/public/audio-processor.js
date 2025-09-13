// public/audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Buffer to collect audio samples before sending
    this.sampleBuffer = [];
    this.bufferSize = 2048; // Smaller buffer for more frequent updates
    console.log('AudioProcessor initialized with buffer size:', this.bufferSize);
  }

  // This method is called for every chunk of audio data (128 samples)
  process(inputs, outputs, parameters) {
    // We expect only one input, which is the microphone audio
    const input = inputs[0];

    // Process only if we have input data
    if (input.length > 0 && input[0]) {
      const channelData = input[0];

      // Add samples to our buffer
      for (let i = 0; i < channelData.length; i++) {
        this.sampleBuffer.push(channelData[i]);
      }

      // If buffer is full, process and send the audio data
      if (this.sampleBuffer.length >= this.bufferSize) {
        this.processBuffer();
      }
    }

    // Return true to keep the processor alive
    return true;
  }

  processBuffer() {
    // Convert the Float32Array to a 16-bit PCM Int16Array, as required by Vosk
    const pcmData = new Int16Array(this.sampleBuffer.length);

    for (let i = 0; i < this.sampleBuffer.length; i++) {
      // Clamp the float value to [-1, 1] range
      let sample = Math.max(-1, Math.min(1, this.sampleBuffer[i]));
      // Convert to 16-bit signed integer
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    console.log(`AudioProcessor: Converting ${this.sampleBuffer.length} samples to PCM`);

    // Post the raw PCM data back to the main thread
    // Use transferable objects for better performance
    this.port.postMessage({
      type: 'audio',
      data: pcmData.buffer
    }, [pcmData.buffer]);

    // Clear the buffer for next chunk
    this.sampleBuffer = [];
  }
}

registerProcessor('audio-processor', AudioProcessor);