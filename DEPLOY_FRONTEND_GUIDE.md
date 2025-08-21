# Frontend Deployment Guide - Sathya Dev Environment

## 🎯 **Your Backend is Ready!**
- ✅ **API URL**: `https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod/`
- ✅ **WebSocket URL**: `wss://861cq5e78g.execute-api.us-east-1.amazonaws.com/sathya-dev`
- ✅ **Claude 3.5 Sonnet v2** - Best model for medical documentation
- ✅ **Deepgram API** - Configured for real-time transcription

## 🚀 **Deploy Frontend Commands**

### **Step 1: Deploy to Vercel**
```bash
# From the ai-scribe directory
vercel login  # If needed
vercel deploy --yes
```

### **Step 2: Set Environment Variables**
```bash
# Set your API endpoints
vercel env add NEXT_PUBLIC_API_URL
# Enter: https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod/

vercel env add NEXT_PUBLIC_WS_URL
# Enter: wss://861cq5e78g.execute-api.us-east-1.amazonaws.com/sathya-dev

vercel env add NEXT_PUBLIC_ENVIRONMENT
# Enter: sathya-dev
```

### **Step 3: Redeploy with Environment Variables**
```bash
vercel --prod
```

## 🧪 **Test Complete SOAP Notes Workflow**

### **After Frontend Deployment:**

1. **🔐 User Registration**
   - Go to your Vercel URL
   - Register a new account (this creates Cognito user)

2. **👤 Create Patient** 
   - Add a test patient
   - Enter basic demographics

3. **📋 Create Encounter**
   - Start new encounter for the patient
   - Add encounter details

4. **🎙️ Record Audio & Generate SOAP Note**
   - Start recording with consent
   - Speak a medical conversation (2-3 minutes)
   - Stop recording → This triggers:
     - ✅ Real-time transcription (Deepgram)
     - ✅ Automatic SOAP note generation (Claude 3.5 Sonnet v2)
     - ✅ Medical code suggestions (ICD-10/CPT)

5. **📝 Edit & Sign Note**
   - Review generated SOAP note
   - Edit any sections as needed
   - Add/modify medical codes
   - Sign and lock the note

## 🎉 **Expected Results**

### **SOAP Note Quality with Claude 3.5 Sonnet v2:**
- **Structured SOAP format** - Perfect medical documentation
- **Accurate medical terminology** - Professional clinical language
- **Relevant ICD-10/CPT codes** - Proper diagnostic/procedure codes
- **Clinical objectivity** - No hallucinated details
- **Auto-save functionality** - Every 10 seconds

### **System Performance:**
- **<10 second note generation** - From transcription to SOAP note
- **Real-time transcription** - Live speech-to-text
- **Instant auto-save** - No data loss
- **Complete audit trail** - All actions logged

## 🔧 **Environment URLs Structure**

### **Expected Vercel URL:**
- **Preview**: `https://ai-scribe-git-soap-notes-yourteam.vercel.app`
- **Production**: `https://your-project-name.vercel.app`

### **Backend Resources (Already Deployed):**
- **Stack**: `ai-scribe-sathya-dev`
- **DynamoDB**: `ai-scribe-main-sathya-dev`
- **S3 Bucket**: `ai-scribe-audio-sathya-dev-194722432945-v2`
- **Model**: Claude 3.5 Sonnet v2 (anthropic.claude-3-5-sonnet-20241022-v2:0)

## 🚨 **Troubleshooting**

### **If Frontend Errors:**
1. Check environment variables are set correctly
2. Verify API endpoints are accessible
3. Check browser console for specific errors

### **If SOAP Notes Don't Generate:**
1. Check CloudWatch logs: `/aws/lambda/ai-scribe-sathya-dev-generate-note`
2. Verify Bedrock permissions for Claude 3.5 Sonnet v2
3. Check EventBridge event publishing

### **If Transcription Fails:**
1. Verify Deepgram API key is configured
2. Check microphone permissions in browser
3. Check WebSocket connection

## 🎯 **Success Indicators**

✅ **Frontend loads** - Login/signup pages work
✅ **Authentication works** - Can register and login
✅ **Patient creation** - Can add new patients
✅ **Encounter management** - Can create encounters
✅ **Audio recording** - Microphone access works
✅ **Real-time transcription** - See text appear during recording
✅ **SOAP note generation** - Note appears after recording stops
✅ **Note editing** - Can modify sections and codes
✅ **Digital signature** - Can sign and lock notes

Your **sathya-dev** environment is now ready for comprehensive medical documentation testing! 🏥✨