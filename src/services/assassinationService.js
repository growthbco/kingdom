/**
 * Service to track active assassination attempts and guard blocks
 */

// In-memory storage for active assassination attempts
// Structure: { chatId: { assassinId, victimId, startTime, blockedBy: [], timer, isKingQueen: boolean } }
const activeAttempts = new Map();

const BLOCK_WINDOW_MS = 90000; // 90 seconds
const GUARD_REWARD = 25;

/**
 * Start an assassination attempt
 * Returns true if attempt started, false if one already exists
 * @param {boolean} isKingQueen - true for king/queen assassination (guard-based), false for power users (shield-based)
 */
function startAttempt(chatId, assassinId, victimId, isKingQueen = true) {
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
    timer: null,
    isKingQueen: isKingQueen || false // Default to true for backward compatibility
  };
  
  activeAttempts.set(key, attempt);
  
  // Note: Timer is handled by the assassination command, not here
  // This allows the command to handle the expiration logic
  
  return true;
}

/**
 * Block an assassination attempt (guard-based for king/queen)
 * Returns { success: boolean, message: string }
 */
function blockAttempt(chatId, guardId) {
  const key = chatId.toString();
  const attempt = activeAttempts.get(key);
  
  if (!attempt) {
    return { success: false, message: 'No active assassination attempt to block.' };
  }
  
  // Check if this is a king/queen assassination (guard-based)
  if (!attempt.isKingQueen) {
    return { success: false, message: 'This kill attempt requires a shield to block. Use /blockkill instead.' };
  }
  
  // Check if already blocked by this guard
  if (attempt.blockedBy.includes(guardId)) {
    return { success: false, message: 'You have already blocked this attempt!' };
  }
  
  // Check if time has expired
  const elapsed = Date.now() - attempt.startTime;
  if (elapsed >= BLOCK_WINDOW_MS) {
    return { success: false, message: 'Too late! The 90-second window has expired.' };
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
    blockedBy: blockedBy,
    isKingQueen: true
  };
}

/**
 * Block an assassination attempt (shield-based for power users)
 * Returns { success: boolean, message: string }
 */
function blockAttemptWithShield(chatId, blockerId) {
  const key = chatId.toString();
  const attempt = activeAttempts.get(key);
  
  if (!attempt) {
    return { success: false, message: 'No active assassination attempt to block.' };
  }
  
  // Check if this is a power user assassination (shield-based)
  if (attempt.isKingQueen) {
    return { success: false, message: 'This kill attempt requires guards to block. Use /block instead.' };
  }
  
  // Check if already blocked
  if (attempt.blockedBy.includes(blockerId)) {
    return { success: false, message: 'This attempt has already been blocked!' };
  }
  
  // Check if time has expired
  const elapsed = Date.now() - attempt.startTime;
  if (elapsed >= BLOCK_WINDOW_MS) {
    return { success: false, message: 'Too late! The 90-second window has expired.' };
  }
  
  // Add blocker
  attempt.blockedBy.push(blockerId);
  
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
    blockedBy: blockedBy,
    isKingQueen: false
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
  blockAttemptWithShield,
  hasActiveAttempt,
  getActiveAttempt,
  cancelAttempt,
  getRemainingTime,
  BLOCK_WINDOW_MS,
  GUARD_REWARD
};

