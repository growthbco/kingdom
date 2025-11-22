/**
 * Service to track recent market attacks (dynamite/bomb) for shield blocking
 */

// In-memory storage for recent market attacks
// Structure: Map<targetUserId, { attackerId, targetUserId, attackType, ticketsLost, timestamp, reason, chatId }>
const recentAttacks = new Map();

const BLOCK_WINDOW_MS = 120000; // 2 minutes

/**
 * Record a market attack (dynamite or bomb)
 */
function recordAttack(targetUserId, attackerId, attackType, ticketsLost, reason, chatId) {
  const attack = {
    attackerId,
    targetUserId,
    attackType, // 'dynamite' or 'bomb'
    ticketsLost,
    timestamp: Date.now(),
    reason: reason || 'No reason provided',
    chatId: chatId.toString()
  };
  
  // Store attack (overwrites any previous attack on this target)
  recentAttacks.set(targetUserId.toString(), attack);
  
  // Auto-cleanup after window expires
  setTimeout(() => {
    const stored = recentAttacks.get(targetUserId.toString());
    if (stored && stored.timestamp === attack.timestamp) {
      recentAttacks.delete(targetUserId.toString());
    }
  }, BLOCK_WINDOW_MS);
}

/**
 * Get recent attack on a user
 * Returns attack object or null if none found or expired
 */
function getRecentAttack(targetUserId) {
  const attack = recentAttacks.get(targetUserId.toString());
  
  if (!attack) {
    return null;
  }
  
  // Check if attack is still within window
  const elapsed = Date.now() - attack.timestamp;
  if (elapsed >= BLOCK_WINDOW_MS) {
    recentAttacks.delete(targetUserId.toString());
    return null;
  }
  
  return attack;
}

/**
 * Block a recent attack (removes it from tracking)
 */
function blockAttack(targetUserId) {
  return recentAttacks.delete(targetUserId.toString());
}

/**
 * Get remaining time in seconds for an attack
 */
function getRemainingTime(targetUserId) {
  const attack = getRecentAttack(targetUserId);
  if (!attack) return 0;
  
  const elapsed = Date.now() - attack.timestamp;
  const remaining = Math.max(0, BLOCK_WINDOW_MS - elapsed);
  return Math.ceil(remaining / 1000);
}

/**
 * Clean up expired attacks (can be called periodically)
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [targetUserId, attack] of recentAttacks.entries()) {
    const elapsed = now - attack.timestamp;
    if (elapsed >= BLOCK_WINDOW_MS) {
      recentAttacks.delete(targetUserId);
    }
  }
}

module.exports = {
  recordAttack,
  getRecentAttack,
  blockAttack,
  getRemainingTime,
  cleanupExpired,
  BLOCK_WINDOW_MS
};


