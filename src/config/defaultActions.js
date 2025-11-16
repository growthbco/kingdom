/**
 * Default redemption actions for The Kingdom game
 * These actions are loaded when the database is initialized
 */

module.exports = [
  {
    actionName: "Challenge King",
    description: "Initiate a challenge to become King (requires majority vote)",
    ticketCost: 10
  },
  {
    actionName: "Skip Rule",
    description: "Temporarily ignore one rule for yourself",
    ticketCost: 5
  },
  {
    actionName: "Pardon Peasant",
    description: "Bring someone back from prison chat",
    ticketCost: 15
  },
  {
    actionName: "Extra Vote",
    description: "Get an additional vote in the next decision",
    ticketCost: 8
  },
  {
    actionName: "Rule Proposal",
    description: "Propose a new rule (requires Enforcer approval)",
    ticketCost: 3
  },
  {
    actionName: "Protection",
    description: "Protect yourself from being banned for 24 hours",
    ticketCost: 12
  }
];





