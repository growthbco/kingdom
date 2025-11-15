const OpenAI = require('openai');
require('dotenv').config();

let openai = null;

// Initialize OpenAI if API key is provided
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Summarize chat messages using OpenAI
 */
async function summarizeChat(messages, hours = 24, previousSummary = null) {
  if (!openai) {
    return null; // OpenAI not configured
  }

  try {
    // Format messages for the prompt
    // Take more messages but prioritize recent ones
    const messageCount = Math.min(messages.length, 100);
    const formattedMessages = messages
      .slice(-messageCount) // Get last N messages
      .map(msg => {
        const username = msg.username || `User_${msg.userId || 'unknown'}`;
        const time = new Date(msg.createdAt).toLocaleTimeString();
        return `[${time}] ${username}: ${msg.messageText}`;
      })
      .join('\n');

    if (!formattedMessages.trim()) {
      return null;
    }

    // Generate a unique style variation each time
    const styleVariations = [
      'a dramatic court chronicler',
      'a gossip columnist',
      'a news anchor reporting breaking news',
      'a bard telling epic tales',
      'a historian documenting events',
      'a tabloid journalist',
      'a royal scribe',
      'a town crier'
    ];
    const style = styleVariations[Math.floor(Math.random() * styleVariations.length)];

    let contextNote = '';
    if (previousSummary) {
      contextNote = `\n\nIMPORTANT: A previous recap was generated. DO NOT repeat the same information. Focus ONLY on NEW events, conversations, and drama that happened AFTER the previous recap.`;
    } else {
      contextNote = `\n\nThis is a fresh recap. Cover the most interesting and dramatic moments from the chat.`;
    }

    const prompt = `You are ${style} documenting the chaos of "The Kingdom" - a Telegram group where people have roles (King/Queen, Enforcer, Lawyer, Peasants), earn tickets as prizes, and can be sent to jail for breaking rules.

Write a DRAMATIC, FUNNY, and ENTERTAINING summary of the NEW chat messages below. ${contextNote}

Focus on:
- NEW dramatic conflicts and power struggles
- NEW funny moments and chaos
- NEW notable conversations and topics
- NEW juicy drama
- What makes THIS recap unique and different

Write 3-5 sentences in a ${style} style. Be creative, vary your language, and make each recap feel fresh and unique. Use emojis sparingly but effectively. DO NOT repeat information from previous recaps.

Chat messages (last ${hours.toFixed(1)} hours):
${formattedMessages}

Dramatic Summary:`;

    const systemPrompt = `You are ${style} who writes entertaining, theatrical summaries of group chat drama. Each recap should feel fresh, unique, and different from previous ones. Vary your writing style, focus on NEW content, and make mundane events sound epic and hilarious. Never repeat the same information or use the same phrases.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.95 // Higher temperature for more variation
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Error summarizing chat with OpenAI:', error.message);
    return null;
  }
}

module.exports = {
  summarizeChat,
  isAvailable: () => openai !== null
};

