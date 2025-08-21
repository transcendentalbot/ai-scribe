const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });

const dynamodb = new AWS.DynamoDB.DocumentClient();
const CONNECTIONS_TABLE = 'ai-scribe-ws-connections-production';

async function cleanupOrphanedSessions() {
  console.log('Scanning for orphaned recording sessions...');
  
  try {
    // Scan for all SESSION# items
    const params = {
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'begins_with(connectionId, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'SESSION#'
      }
    };
    
    const result = await dynamodb.scan(params).promise();
    const sessions = result.Items || [];
    
    console.log(`Found ${sessions.length} recording sessions`);
    
    const now = Date.now();
    const maxAgeMinutes = 10;
    const orphanedSessions = [];
    
    for (const session of sessions) {
      try {
        const sessionData = JSON.parse(session.sessionData);
        const startTime = new Date(sessionData.startTime).getTime();
        const ageMinutes = (now - startTime) / (1000 * 60);
        
        if (ageMinutes > maxAgeMinutes) {
          orphanedSessions.push({
            connectionId: session.connectionId,
            sessionId: sessionData.sessionId,
            startTime: sessionData.startTime,
            ageMinutes: Math.floor(ageMinutes),
            encounterId: sessionData.encounterId
          });
        }
      } catch (error) {
        console.error(`Error parsing session ${session.connectionId}:`, error);
      }
    }
    
    console.log(`\nFound ${orphanedSessions.length} orphaned sessions older than ${maxAgeMinutes} minutes:`);
    
    for (const orphaned of orphanedSessions) {
      console.log(`- Session ${orphaned.sessionId}: ${orphaned.ageMinutes} minutes old (Encounter: ${orphaned.encounterId})`);
    }
    
    if (orphanedSessions.length > 0) {
      console.log('\nDeleting orphaned sessions...');
      
      for (const orphaned of orphanedSessions) {
        try {
          await dynamodb.delete({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: orphaned.connectionId }
          }).promise();
          console.log(`✓ Deleted session ${orphaned.sessionId}`);
        } catch (error) {
          console.error(`✗ Failed to delete session ${orphaned.sessionId}:`, error.message);
        }
      }
    }
    
    console.log('\nCleanup complete!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupOrphanedSessions();