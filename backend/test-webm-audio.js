const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@deepgram/sdk');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function testWebMAudio() {
  console.log('Testing WebM audio transcription...');
  
  // Get a recent recording from S3
  const s3Client = new S3Client({ region: 'us-east-1' });
  
  // Use the S3 key from the logs
  const s3Key = 'recordings/42ef0317-04ca-4330-9ee4-6e763517f5a0/01f89edb-328e-4fa6-be51-9a0d05a159b4/audio.webm';
  
  try {
    console.log('Downloading audio from S3:', s3Key);
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: 'ai-scribe-audio-production-194722432945-v2',
      Key: s3Key,
    }));
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of getObjectResponse.Body) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    console.log('Downloaded audio, size:', audioBuffer.length, 'bytes');
    
    // Check WebM header
    const header = audioBuffer.slice(0, 4).toString('hex');
    console.log('File header:', header);
    console.log('Is WebM:', header === '1a45dfa3');
    
    // Get Deepgram API key
    const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: 'ai-scribe-production-deepgram',
      })
    );
    
    const deepgram = createClient(secretResponse.SecretString);
    
    // Test 1: Let Deepgram auto-detect format
    console.log('\nTest 1: Auto-detect format...');
    try {
      const response1 = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2-medical',
        punctuate: true,
        language: 'en-US',
        smart_format: true,
      });
      
      console.log('Auto-detect result:', JSON.stringify(response1.result.results.channels[0].alternatives[0], null, 2));
    } catch (error) {
      console.error('Auto-detect error:', error.message);
    }
    
    // Test 2: Specify WebM format
    console.log('\nTest 2: Specify WebM format...');
    try {
      const response2 = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2-medical',
        punctuate: true,
        language: 'en-US',
        mimetype: 'audio/webm',
        smart_format: true,
      });
      
      console.log('WebM result:', JSON.stringify(response2.result.results.channels[0].alternatives[0], null, 2));
    } catch (error) {
      console.error('WebM error:', error.message);
    }
    
    // Test 3: Try with general model
    console.log('\nTest 3: General model...');
    try {
      const response3 = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2-general',
        punctuate: true,
        language: 'en-US',
        smart_format: true,
      });
      
      console.log('General model result:', JSON.stringify(response3.result.results.channels[0].alternatives[0], null, 2));
    } catch (error) {
      console.error('General model error:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testWebMAudio().catch(console.error);