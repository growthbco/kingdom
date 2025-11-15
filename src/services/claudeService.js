const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

let anthropic = null;

// Initialize Anthropic if API key is provided
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

/**
 * Summarize chat messages using Claude
 */
async function summarizeChat(messages, hours = 24, previousSummary = null) {
  if (!anthropic) {
    return null; // Claude not configured
  }

  try {
    // Format messages for the prompt
    const messageCount = Math.min(messages.length, 100);
    console.log(`Claude: Processing ${messages.length} messages, using last ${messageCount} for summary`);
    const formattedMessages = messages
      .slice(-messageCount)
      .map(msg => {
        const username = msg.username || `User_${msg.userId || 'unknown'}`;
        const time = new Date(msg.createdAt).toLocaleTimeString();
        return `[${time}] ${username}: ${msg.messageText}`;
      })
      .join('\n');

    if (!formattedMessages.trim()) {
      console.log('Claude: No formatted messages to summarize');
      return null;
    }
    
    console.log(`Claude: Sending ${formattedMessages.length} characters to Claude API`);

    let contextNote = '';
    if (previousSummary) {
      contextNote = `\n\nIMPORTANT: A previous recap was generated. DO NOT repeat the same information. Focus ONLY on NEW events, conversations, and drama that happened AFTER the previous recap.`;
    } else {
      contextNote = `\n\nThis is a fresh recap. Cover the most interesting and dramatic moments from the chat.`;
    }

    const prompt = `You're helping summarize what's been happening in "The Kingdom" - a Telegram group where people have roles (King/Queen, Enforcer, Lawyer, Peasants), earn tickets, and can be sent to jail.

Read through the chat messages below and give a friendly, conversational recap of what's been going on. Write it like you're casually catching someone up on the group chat - be natural, engaging, and highlight the interesting stuff.

${contextNote}

Write in a friendly, modern conversational style - like Meta AI or a helpful friend catching you up. Be casual but informative. Use natural language, be engaging, and make it feel like a real conversation.

Focus on:
- Interesting conversations and topics
- Funny moments or drama
- Notable events and interactions
- What people have been talking about
- Any notable patterns or themes

Write 4-6 sentences in a friendly, conversational style. Be natural, engaging, and make it feel like you're genuinely catching someone up on what they missed. DO NOT repeat information from previous recaps.

Chat messages from the last ${hours.toFixed(1)} hours:
${formattedMessages}

Recap:`;

    const systemPrompt = `You're a helpful AI assistant summarizing group chat activity. Write in a friendly, conversational, modern style - like Meta AI or a helpful friend. Be natural, engaging, and casual but informative. Focus on NEW content and never repeat previous recaps. Make each recap feel fresh and like you're genuinely catching someone up on what happened.`;

    // Try different model names - Anthropic model naming can vary
    const modelsToTry = [
      'claude-3-opus-20240229',  // Claude 3 Opus
      'claude-3-sonnet-20240229', // Claude 3 Sonnet
      'claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet
      'claude-3-haiku-20240307'  // Claude 3 Haiku (fallback)
    ];
    
    let response = null;
    let lastError = null;
    
    for (const model of modelsToTry) {
      try {
        console.log(`Claude: Trying model ${model}`);
        response = await anthropic.messages.create({
          model: model,
          max_tokens: 600,
          temperature: 0.9,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        console.log(`Claude: Successfully used model ${model}`);
        break; // Success, exit loop
      } catch (error) {
        console.log(`Claude: Model ${model} failed: ${error.message}`);
        lastError = error;
        continue; // Try next model
      }
    }
    
    if (!response) {
      throw lastError || new Error('All Claude models failed');
    }

    const summary = response.content[0].text.trim() || null;
    console.log(`Claude: Successfully generated summary (${summary?.length || 0} characters)`);
    return summary;
  } catch (error) {
    console.error('Error summarizing chat with Claude:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return null;
  }
}

module.exports = {
  summarizeChat,
  isAvailable: () => anthropic !== null
};

