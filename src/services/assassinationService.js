/**
 * Service to track active assassination attempts and guard blocks
 */

// In-memory storage for active assassination attempts
// Structure: { chatId: { assassinId, victimId, startTime, blockedBy: [], timer } }
const activeAttempts = new Map();

const BLOCK_WINDOW_MS = 60000; // 60 seconds
const GUARD_REWARD = 25;

/**
 * Start an assassination attempt
 * Returns true if attempt started, false if one already exists
 */
function startAttempt(chatId, assassinId, victimId) {
  const key = chatId.toString();
  
  // Check if there's already an active attempt
  if (activeAttempts.has(key)) {
    return false;
  }
  
  const attempt = {
    assassinId,
    victimId,
    startTime: Date.now(),
    blockedBy: [],
    timer: null
  };
  
  activeAttempts.set(key, attempt);
  
  // Note: Timer is handled by the assassination command, not here
  // This allows the command to handle the expiration logic
  
  return true;
}

/**
 * Block an assassination attempt
 * Returns { success: boolean, message: string }
 */
function blockAttempt(chatId, guardId) {
  const key = chatId.toString();
  const attempt = activeAttempts.get(key);
  
  if (!attempt) {
    return { success: false, message: 'No active assassination attempt to block.' };
  }
  
  // Check if already blocked by this guard
  if (attempt.blockedBy.includes(guardId)) {
    return { success: false, message: 'You have already blocked this attempt!' };
  }
  
  // Check if time has expired
  const elapsed = Date.now() - attempt.startTime;
  if (elapsed >= BLOCK_WINDOW_MS) {
    return { success: false, message: 'Too late! The 60-second window has expired.' };
  }
  
  // Add guard to blockers
  attempt.blockedBy.push(guardId);
  
  // Clear the timer since it's blocked (if it exists)
  if (attempt.timer) {
    clearTimeout(attempt.timer);
    attempt.timer = null;
  }
  
  // Store blockedBy array before deletion
  const blockedBy = [...attempt.blockedBy];
  
  // Remove from active attempts
  activeAttempts.delete(key);
  
  return { 
    success: true, 
    message: 'Assassination attempt blocked!',
    assassinId: attempt.assassinId,
    victimId: attempt.victimId,
    blockedBy: blockedBy
  };
}

/**
 * Check if there's an active attempt
 */
function hasActiveAttempt(chatId) {
  return activeAttempts.has(chatId.toString());
}

/**
 * Get active attempt info
 */
function getActiveAttempt(chatId) {
  return activeAttempts.get(chatId.toString());
}

/**
 * Expire an attempt (timeout reached)
 */
function expireAttempt(key) {
  const attempt = activeAttempts.get(key);
  if (attempt) {
    activeAttempts.delete(key);
  }
}

/**
 * Cancel an attempt (e.g., if assassin wants to cancel)
 */
function cancelAttempt(chatId) {
  const key = chatId.toString();
  const attempt = activeAttempts.get(key);
  
  if (attempt && attempt.timer) {
    clearTimeout(attempt.timer);
  }
  
  return activeAttempts.delete(key);
}

/**
 * Get remaining time in seconds
 */
function getRemainingTime(chatId) {
  const attempt = activeAttempts.get(chatId.toString());
  if (!attempt) return 0;
  
  const elapsed = Date.now() - attempt.startTime;
  const remaining = Math.max(0, BLOCK_WINDOW_MS - elapsed);
  return Math.ceil(remaining / 1000);
}

module.exports = {
  startAttempt,
  blockAttempt,
  hasActiveAttempt,
  getActiveAttempt,
  cancelAttempt,
  getRemainingTime,
  BLOCK_WINDOW_MS,
  GUARD_REWARD
};

