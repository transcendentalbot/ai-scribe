const { createClient } = require('@deepgram/sdk');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function testDeepgram() {
  console.log('Testing Deepgram connection...');
  
  // Get API key from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: 'ai-scribe-production-deepgram',
    })
  );
  
  const apiKey = secretResponse.SecretString;
  console.log('API key loaded, length:', apiKey.length);
  
  // Create Deepgram client
  const deepgram = createClient(apiKey);
  
  // Test 1: Simple prerecorded transcription
  console.log('\nTest 1: Testing prerecorded transcription...');
  try {
    // Create a simple test audio (silence)
    const testAudio = Buffer.alloc(16000); // 1 second of silence at 16kHz
    
    const response = await deepgram.listen.prerecorded.transcribeFile(testAudio, {
      model: 'nova-2-medical',
      punctuate: true,
      language: 'en-US',
      encoding: 'linear16',
      sample_rate: 16000,
    });
    
    console.log('Prerecorded response:', JSON.stringify(response.result, null, 2));
  } catch (error) {
    console.error('Prerecorded error:', error);
  }
  
  // Test 2: Live connection
  console.log('\nTest 2: Testing live connection...');
  try {
    const connection = deepgram.listen.live({
      model: 'nova-2-medical',
      punctuate: true,
      interim_results: true,
      language: 'en-US',
      encoding: 'opus',
      sample_rate: 16000,
      channels: 1,
    });
    
    connection.on('open', () => {
      console.log('Live connection opened');
      
      // Send a small test chunk
      const testChunk = Buffer.alloc(1000);
      connection.send(testChunk);
      console.log('Sent test chunk');
      
      // Close after 2 seconds
      setTimeout(() => {
        connection.finish();
        console.log('Connection closed');
      }, 2000);
    });
    
    connection.on('error', (error) => {
      console.error('Live connection error:', error);
    });
    
    connection.on('close', () => {
      console.log('Live connection closed');
    });
    
    connection.on('Results', (data) => {
      console.log('Results event:', JSON.stringify(data, null, 2));
    });
    
    connection.on('Metadata', (data) => {
      console.log('Metadata event:', JSON.stringify(data, null, 2));
    });
    
  } catch (error) {
    console.error('Live connection error:', error);
  }
}

// Run the test
testDeepgram().catch(console.error);