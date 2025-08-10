// Simple pass-through handler for Cognito triggers
exports.handler = async (event) => {
  console.log('Cognito trigger event:', JSON.stringify(event, null, 2));
  
  // For pre-auth and post-auth triggers, just return the event
  // This allows authentication to proceed normally
  return event;
};