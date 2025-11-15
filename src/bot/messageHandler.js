const nlp = require('compromise');

/**
 * Parse message to extract command and arguments
 * Supports both prefix commands (/command) and natural language
 */
function parseMessage(text) {
  const trimmed = text.trim();
  
  // Check for prefix commands
  if (trimmed.startsWith('/')) {
    return parsePrefixCommand(trimmed);
  }
  
  // Try natural language parsing
  return parseNaturalLanguage(trimmed);
}

/**
 * Parse prefix command (e.g., /award @user 5 reason)
 */
function parsePrefixCommand(text) {
  const parts = text.split(/\s+/);
  const command = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);
  
  return {
    type: 'command',
    command,
    args,
    originalText: text
  };
}

/**
 * Parse natural language message
 */
function parseNaturalLanguage(text) {
  const doc = nlp(text);
  const lowerText = text.toLowerCase();
  
  // Intent detection patterns
  const intents = {
    // Award tickets
    award: /(?:give|award|grant|give|hand out).*?(?:ticket|🎫)/i,
    // Check balance
    balance: /(?:how many|how much|balance|tickets do i have|my tickets)/i,
    // View rules
    rules: /(?:what are|show|list|tell me).*?(?:rule|rules)/i,
    // View actions
    actions: /(?:what can|show|list).*?(?:action|redeem|buy)/i,
    // Status queries
    status: /(?:who is|who's|what is|status|current).*?(?:king|queen|enforcer)/i,
    // Leaderboard
    leaderboard: /(?:leaderboard|top|who has most|richest)/i,
    // Help
    help: /(?:help|commands|what can|how do)/i
  };
  
  // Check for role setting
  if (/set.*?(?:king|queen|enforcer|guard|peasant)/i.test(text)) {
    return {
      type: 'command',
      command: extractRoleCommand(text),
      args: extractMention(text),
      originalText: text
    };
  }
  
  // Check for ban/pardon
  if (/ban|remove|kick/i.test(text) && /@|user|them/i.test(text)) {
    return {
      type: 'command',
      command: 'ban',
      args: extractMention(text).concat(extractReason(text)),
      originalText: text
    };
  }
  
  if (/pardon|forgive|bring back/i.test(text)) {
    return {
      type: 'command',
      command: 'pardon',
      args: extractMention(text),
      originalText: text
    };
  }
  
  // Check for redeem
  if (/(?:redeem|buy|use|spend).*?(?:ticket|action)/i.test(text)) {
    return {
      type: 'command',
      command: 'redeem',
      args: extractActionName(text),
      originalText: text
    };
  }
  
  // Check intents
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(text)) {
      return {
        type: 'intent',
        intent,
        originalText: text
      };
    }
  }
  
  // Check if it's a question (ends with ? or contains question words)
  if (text.includes('?') || /\b(?:who|what|when|where|why|how|is|are|can|do|does|will)\b/i.test(text)) {
    // Try to match common queries even if not exact intent
    if (/king|queen|enforcer/i.test(text)) {
      return {
        type: 'intent',
        intent: 'status',
        originalText: text
      };
    }
    if (/ticket|balance|how many/i.test(text)) {
      return {
        type: 'intent',
        intent: 'balance',
        originalText: text
      };
    }
  }
  
  // Default: unknown
  return {
    type: 'unknown',
    originalText: text
  };
}

/**
 * Extract role command from text
 */
function extractRoleCommand(text) {
  const roles = ['king', 'queen', 'enforcer', 'lawyer', 'peasant'];
  const lowerText = text.toLowerCase();
  
  for (const role of roles) {
    if (lowerText.includes(role)) {
      return `set${role.charAt(0).toUpperCase() + role.slice(1)}`;
    }
  }
  
  return null;
}

/**
 * Extract user mention from text
 * Telegram supports @username mentions
 */
function extractMention(text) {
  // Extract @username patterns
  const mentions = text.match(/@(\w+)/g) || [];
  return mentions.map(m => m.substring(1));
}

/**
 * Extract reason from text (everything after mention)
 */
function extractReason(text) {
  const parts = text.split(/\s+/);
  const mentionIndex = parts.findIndex(p => p.startsWith('@'));
  if (mentionIndex >= 0) {
    return parts.slice(mentionIndex + 1).join(' ');
  }
  return '';
}

/**
 * Extract action name from text
 */
function extractActionName(text) {
  // Try to find action name after redeem/buy/use
  const match = text.match(/(?:redeem|buy|use|spend).*?["']?([^"']+)["']?/i);
  if (match) {
    return [match[1].trim()];
  }
  return [];
}

module.exports = {
  parseMessage
};

