import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@deepgram/sdk';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[TestTranscription] Testing Deepgram with WebM audio');
  
  try {
    // Get Deepgram API key
    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: process.env.DEEPGRAM_SECRET_NAME || 'ai-scribe-production-deepgram',
      })
    );
    
    const deepgram = createClient(secretResponse.SecretString!);
    
    // Test with a simple audio buffer
    const testAudio = Buffer.from('test audio data');
    
    const response = await deepgram.listen.prerecorded.transcribeFile(testAudio, {
      model: 'nova-2-general',
      punctuate: true,
      language: 'en-US',
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Test completed',
        result: response.result,
      }),
    };
  } catch (error: any) {
    console.error('[TestTranscription] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Test failed',
        error: error.message,
      }),
    };
  }
};