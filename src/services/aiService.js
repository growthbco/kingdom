const claudeService = require('./claudeService');
const openaiService = require('./openaiService');

/**
 * Summarize chat messages using available AI services
 * Tries Claude first, falls back to OpenAI
 */
async function summarizeChat(messages, hours, previousSummary) {
  // Try Claude first (if available)
  if (claudeService.isAvailable()) {
    try {
      const summary = await claudeService.summarizeChat(messages, hours, previousSummary);
      if (summary) {
        return summary;
      }
    } catch (error) {
      console.error('Claude service failed, falling back to OpenAI:', error.message);
      // Continue to fallback - don't return null yet
    }
  }
  
  // Fallback to OpenAI
  if (openaiService.isAvailable()) {
    try {
      const summary = await openaiService.summarizeChat(messages, hours, previousSummary);
      if (summary) {
        return summary;
      }
    } catch (error) {
      console.error('OpenAI service also failed:', error.message);
    }
  }
  
  return null;
}

/**
 * Check if any AI service is available
 */
function isAvailable() {
  return claudeService.isAvailable() || openaiService.isAvailable();
}

module.exports = {
  summarizeChat,
  isAvailable
};

