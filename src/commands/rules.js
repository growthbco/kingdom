const ruleService = require('../services/ruleService');
const roleService = require('../services/roleService');
const activityService = require('../services/activityService');
const { sendMessage } = require('../bot/telegramBot');

/**
 * Create scroll border with content
 */
function createScroll(content) {
  const scrollTop = "╔════════════════════════════════════════╗";
  const scrollBottom = "╚════════════════════════════════════════╝";
  
  // Wrap content lines to fit scroll width
  const maxWidth = 40;
  const contentLines = content.split('\n');
  const wrappedLines = [];
  
  contentLines.forEach(line => {
    // Handle markdown formatting - don't break in middle of bold
    if (line.length <= maxWidth) {
      wrappedLines.push(line);
    } else {
      // Simple word wrap
      const words = line.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        if ((currentLine + word).length <= maxWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) wrappedLines.push(currentLine);
          currentLine = word;
        }
      });
      
      if (currentLine) wrappedLines.push(currentLine);
    }
  });
  
  let scroll = scrollTop + "\n";
  
  // Add content without side borders - cleaner look
  wrappedLines.forEach(line => {
    scroll += line + "\n";
  });
  
  scroll += scrollBottom;
  
  return scroll;
}

/**
 * List all active rules with scroll animation
 */
async function list(context) {
  try {
    const { message } = context;
    const chatId = message.chat.id.toString();
    
    const rules = await ruleService.getActiveRules();
    
    if (rules.length === 0) {
      return "📜 No active rules.";
    }
    
    // Group by category
    const byCategory = {};
    rules.forEach(rule => {
      const cat = rule.category || 'General';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(rule);
    });
    
    // Build content
    let content = "📜 THE KINGDOM RULES 📜\n\n";
    
    for (const [category, categoryRules] of Object.entries(byCategory)) {
      content += `${category}:\n`;
      categoryRules.forEach((rule, idx) => {
        content += `${idx + 1}. ${rule.ruleText}\n`;
      });
      content += "\n";
    }
    
    content = content.trim();
    
    // Animation stages - progressively reveal the scroll
    const animationStages = [
      { delay: 200, text: "📜 *Unrolling the ancient scroll...*" },
      { delay: 300, text: "📜 *The scroll continues to unfurl...*" },
      { delay: 300, text: "📜 *Almost there...*" }
    ];
    
    // Send animation stages
    for (const stage of animationStages) {
      await new Promise(resolve => setTimeout(resolve, stage.delay));
      try {
        await sendMessage(chatId, stage.text);
      } catch (error) {
        console.error('Error sending scroll animation:', error);
      }
    }
    
    // Final delay before showing scroll
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Send the final scroll
    const scrollContent = createScroll(content);
    
    try {
      await sendMessage(chatId, scrollContent);
    } catch (error) {
      console.error('Error sending scroll:', error);
      // Fallback to simple format
      return scrollContent;
    }
    
    // Return null since we're sending messages directly
    return null;
  } catch (error) {
    console.error('Error in rules list:', error);
    return `❌ Error: ${error.message}`;
  }
}

module.exports = {
  list
};

