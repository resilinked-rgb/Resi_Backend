// Lazy load Google Generative AI and Dialogflow to avoid crashes if API keys are missing
let GoogleGenerativeAI, genAI, dialogflow, sessionClient;

// Load Gemini AI
try {
  const generativeAI = require('@google/generative-ai');
  if (generativeAI && generativeAI.GoogleGenerativeAI) {
    GoogleGenerativeAI = generativeAI.GoogleGenerativeAI;
    // Only initialize if API key exists
    if (process.env.GEMINI_API_KEY) {
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log('✅ Gemini AI initialized successfully');
    } else {
      console.warn('⚠️ GEMINI_API_KEY not found in environment variables');
    }
  }
} catch (error) {
  console.warn('⚠️ Google Generative AI package not loaded:', error.message);
}

// Load Dialogflow
try {
  dialogflow = require('@google-cloud/dialogflow');
  // Only initialize if credentials exist
  if (process.env.DIALOGFLOW_PROJECT_ID && process.env.DIALOGFLOW_CREDENTIALS) {
    const credentials = JSON.parse(process.env.DIALOGFLOW_CREDENTIALS);
    sessionClient = new dialogflow.SessionsClient({
      credentials: credentials
    });
    console.log('✅ Dialogflow initialized successfully');
  } else {
    console.warn('⚠️ DIALOGFLOW_PROJECT_ID or DIALOGFLOW_CREDENTIALS not found');
  }
} catch (error) {
  console.warn('⚠️ Dialogflow package not loaded:', error.message);
}

/**
 * CHATBOT QUERY
 * Handle chatbot queries using Dialogflow (primary) with Gemini AI fallback
 * Strategy: Use Dialogflow for basic questions. If confidence < 50%, use Gemini.
 */
const chatbotQuery = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
        alert: 'Please provide a message'
      });
    }

    let botResponse = null;
    let source = 'fallback';
    let confidence = 0;

    console.log('🤖 Chatbot query received:', message);
    console.log('📊 Dialogflow available:', !!sessionClient);
    console.log('📊 Gemini available:', !!genAI);

    // Step 1: Try Dialogflow first for basic questions
    if (sessionClient && process.env.DIALOGFLOW_PROJECT_ID) {
      try {
        console.log('🔄 Trying Dialogflow...');
        const sessionPath = sessionClient.projectAgentSessionPath(
          process.env.DIALOGFLOW_PROJECT_ID,
          userId
        );

        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              text: message,
              languageCode: 'en-US',
            },
          },
        };

        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        
        const intentName = result.intent?.displayName || 'Unknown';
        confidence = result.intentDetectionConfidence || 0;
        console.log(`✅ Dialogflow response - Intent: ${intentName}, Confidence: ${Math.round(confidence * 100)}%`);

        // If it's a fallback intent, treat as low confidence regardless of score
        const isFallbackIntent = intentName.toLowerCase().includes('fallback') || 
                                 intentName.toLowerCase().includes('default');
        
        // If Dialogflow confidence is >= 50% AND it's not a fallback intent, use its response
        if (confidence >= 0.5 && !isFallbackIntent && result.fulfillmentText) {
          botResponse = result.fulfillmentText;
          source = 'dialogflow';
          console.log('✅ Using Dialogflow response (confidence >= 50%)');
        } else {
          if (isFallbackIntent) {
            console.log('⚠️ Dialogflow returned fallback intent, trying Gemini...');
          } else if (!result.fulfillmentText) {
            console.log('⚠️ Dialogflow has no text response, trying Gemini...');
          } else {
            console.log('⚠️ Dialogflow confidence too low, trying Gemini...');
          }
        }
      } catch (dialogflowError) {
        console.warn('⚠️ Dialogflow query failed:', dialogflowError.message);
        // Continue to Gemini fallback
      }
    }

    // Step 2: If Dialogflow confidence < 50% or failed, use Gemini AI
    if (!botResponse && genAI && process.env.GEMINI_API_KEY) {
      try {
        console.log('🔄 Using Gemini AI for response...');
        const systemPrompt = `You are ResiLinked Assistant, a helpful AI chatbot for ResiLinked - a platform that connects workers and employers in local communities.

ABOUT RESILINKED:
- ResiLinked is a job marketplace connecting local workers with employers
- Workers can create profiles, search jobs, and apply to opportunities
- Employers can post jobs, review worker profiles, and hire workers
- Features include chat messaging, ratings/reviews, and job management

YOUR ROLE:
- Help users understand how to use ResiLinked
- Guide them on posting jobs, finding work, managing profiles
- Explain safety features and best practices
- Assist with common issues and questions
- Be friendly, professional, and concise

KEY FEATURES YOU CAN HELP WITH:
1. **For Workers:**
   - Creating and updating profiles
   - Searching and applying for jobs
   - Communicating with employers
   - Building reputation through ratings

2. **For Employers:**
   - Posting job listings
   - Finding and inviting workers
   - Managing applications
   - Rating worker performance

3. **Safety & Support:**
   - Reporting scammers or inappropriate behavior
   - Submitting support tickets
   - Understanding verification process
   - Payment best practices

4. **Common Actions:**
   - Navigate to /search-jobs for finding work
   - Navigate to /post-job for creating listings
   - Navigate to /help for support tickets
   - Navigate to /profile for account settings

RESPONSE GUIDELINES:
- Keep responses concise (2-4 sentences)
- Use bullet points for lists
- Include relevant emojis sparingly
- Suggest specific actions when applicable
- If unsure, direct users to submit a support ticket at /help
- NEVER make up features that don't exist
- If asked about technical issues, suggest contacting support

Respond naturally and helpfully to user questions about ResiLinked.`;

        // Build conversation context
        let conversationText = systemPrompt + '\n\n';
        
        // Add conversation history (last 5 messages for context)
        const recentHistory = conversationHistory.slice(-5);
        recentHistory.forEach(msg => {
          conversationText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        });
        
        conversationText += `User: ${message}\nAssistant:`;

        // Generate response using Gemini
        // Use gemini-2.0-flash-exp for the latest free tier model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const result = await model.generateContent(conversationText);
        const response = await result.response;
        botResponse = response.text();
        source = 'gemini';
        console.log('✅ Gemini AI response generated successfully');
      } catch (geminiError) {
        console.warn('⚠️ Gemini AI query failed:', geminiError.message);
        // Continue to fallback
      }
    } else if (!botResponse) {
      console.log('⚠️ Gemini not available or no API key, using fallback');
    }

    // Step 3: Final fallback to pattern-based responses
    if (!botResponse) {
      console.log('⚠️ Using fallback pattern-based response');
      botResponse = getFallbackResponse(message);
      source = 'fallback';
    }

    console.log(`✅ Final response - Source: ${source}, Confidence: ${confidence > 0 ? Math.round(confidence * 100) + '%' : 'N/A'}`);

    res.status(200).json({
      success: true,
      data: {
        response: botResponse,
        source: source,
        confidence: confidence > 0 ? Math.round(confidence * 100) : null
      }
    });

  } catch (error) {
    // Error logging removed for security - don't expose details
    
    // Fallback to basic responses if everything fails
    const fallbackResponse = getFallbackResponse(req.body.message || '');
    
    res.status(200).json({
      success: true,
      data: {
        response: fallbackResponse,
        source: 'fallback'
      }
    });
  }
};

/**
 * Fallback responses when AI is not available
 */
function getFallbackResponse(message) {
  const msg = message.toLowerCase();

  // How it works
  if (msg.includes('how') && (msg.includes('work') || msg.includes('use'))) {
    return "ResiLinked connects workers and employers in your local community! 🏘️\n\n📋 **For Workers:** Create your profile, search for jobs, apply to opportunities, and chat with employers.\n\n💼 **For Employers:** Post job listings, review worker profiles, invite workers to jobs, and manage applications.\n\nWhat would you like to know more about?";
  }

  // Report scammer
  if (msg.includes('report') || msg.includes('scam')) {
    return "To report a user:\n1. Go to their profile\n2. Click the 'Report' button\n3. Select the reason and provide details\n\nOur admin team will review within 24-48 hours. Your safety is our priority! 🛡️";
  }

  // Support ticket
  if (msg.includes('support') || msg.includes('ticket') || msg.includes('help') || msg.includes('problem')) {
    return "I can help you submit a support ticket! 🎫\n\nCommon issues we can help with:\n• Account problems\n• Payment issues\n• Profile verification\n• Technical difficulties\n\nVisit /help to create a support ticket.";
  }

  // Find jobs
  if (msg.includes('find') && msg.includes('job')) {
    return "Looking for work? Great! 🎯\n\nTips:\n1. Complete your profile with skills\n2. Add a professional photo\n3. Use search filters effectively\n4. Apply quickly to new postings\n\nVisit /search-jobs to start searching!";
  }

  // Post job
  if (msg.includes('post') && msg.includes('job')) {
    return "Ready to post a job? 📝\n\nBefore posting:\n• Write a clear job title and description\n• Specify required skills\n• Set fair compensation\n• Add job location\n\nVisit /post-job to create your listing!";
  }

  // Safety
  if (msg.includes('safe') || msg.includes('security')) {
    return "Your safety is our priority! 🔒\n\nSafety tips:\n• Verify profiles before hiring\n• Read ratings and reviews\n• Meet in public places first\n• Use in-app messaging\n• Report suspicious behavior\n• Trust your instincts";
  }

  // Payment
  if (msg.includes('pay') || msg.includes('money') || msg.includes('price')) {
    return "💰 ResiLinked is FREE to use!\n\nFor payments between users:\n• Discuss payment terms before starting work\n• Put agreements in writing\n• Use secure payment methods\n• Report payment disputes to support\n\nNeed help with a payment issue? Submit a support ticket at /help";
  }

  // Profile
  if (msg.includes('profile') || msg.includes('account')) {
    return "📱 Managing your profile:\n\n• Update your info anytime at /profile\n• Add skills to match more jobs\n• Upload a profile picture\n• Complete verification for trust\n\nHaving trouble? Submit a support ticket at /help";
  }

  // Default response
  return "I'm here to help! 😊\n\nI can assist you with:\n• How ResiLinked works\n• Finding or posting jobs\n• Reporting issues\n• Safety tips\n• Account help\n\nWhat would you like to know?";
}

module.exports = {
  chatbotQuery
};
