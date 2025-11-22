/**
 * Default rules for The Kingdom game
 * These rules are loaded when the database is initialized
 */

module.exports = [
  {
    ruleText: "No spamming messages",
    category: "Behavior"
  },
  {
    ruleText: "Users must not change their username - your identity in The Kingdom is permanent and changing it is strictly prohibited",
    category: "Behavior"
  },
  {
    ruleText: "Respect the King/Queen's decisions",
    category: "Gameplay"
  },
  {
    ruleText: "Breaking rules results in prison chat removal",
    category: "Enforcement"
  },
  {
    ruleText: "Only Enforcer and King/Queen can award tickets",
    category: "Organization"
  },
  {
    ruleText: "Role changes must be approved by Enforcer or King/Queen",
    category: "Organization"
  },
  {
    ruleText: "Don't piss off the King/Queen - you can be banished at anytime for disrespect or any other reason the King/Queen deems necessary",
    category: "Gameplay"
  },
  {
    ruleText: "You can get back from jail by hiring a lawyer to defend your case",
    category: "Legal System"
  },
  {
    ruleText: "If you lose your case, you and your lawyer forfeit all tickets to the prosecutor",
    category: "Legal System"
  },
  {
    ruleText: "If you win your case, the prosecutor loses all tickets and the King/Queen must provide tickets and prizes to the defendant and lawyer",
    category: "Legal System"
  },
  {
    ruleText: "Assassination attempts cost 100 tickets - guards have 60 seconds to block",
    category: "Assassination"
  },
  {
    ruleText: "If guards block an assassination attempt, the assassin loses all tickets and is sent to jail",
    category: "Assassination"
  },
  {
    ruleText: "Guards who successfully block an assassination receive 25 tickets each",
    category: "Assassination"
  },
  {
    ruleText: "If no guard blocks within 60 seconds, the assassination succeeds and the King/Queen is demoted to Peasant",
    category: "Assassination"
  },
  {
    ruleText: "Daily Welfare: Peasants receive 5 tickets daily, Officials (King/Queen/Enforcer/etc) receive 7 tickets, Prisoners receive 2 tickets",
    category: "Ticket System"
  },
  {
    ruleText: "Activity Rewards: First message of day = 2 tickets, Every 10 messages = 1 ticket (max 5/day), Posting memes = 1 ticket (max 3/day)",
    category: "Ticket System"
  },
  {
    ruleText: "Random ticket drops occur throughout the day - react quickly to claim them",
    category: "Ticket System"
  },
  {
    ruleText: "You can gift tickets to other users using /give (max 10 tickets per day)",
    category: "Ticket System"
  },
  {
    ruleText: "You can pay for services (like lawyers) using /pay (no daily limit)",
    category: "Ticket System"
  },
  {
    ruleText: "Reasons to go to jail: Breaking rules, disrespecting the King/Queen, failed assassination attempts, or any reason the King/Queen deems necessary",
    category: "Enforcement"
  },
  {
    ruleText: "Sending someone to jail costs 5 tickets - only Enforcer and King/Queen can use /jail @user <reason>",
    category: "Enforcement"
  },
  {
    ruleText: "Only Enforcer and King/Queen can use /ban to send users to jail without cost",
    category: "Enforcement"
  },
  {
    ruleText: "Bombs eliminate 5 tickets from any person you choose (use /bomb @user <reason>)",
    category: "Bombs"
  },
  {
    ruleText: "You cannot mention or talk about The Kingdom outside of The Kingdom",
    category: "Behavior"
  }
];


