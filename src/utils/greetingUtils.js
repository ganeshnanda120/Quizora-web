/**
 * Utility functions and data for time-based welcome messages and quotes.
 * Easily expandable for custom quotes or localization.
 */

export const TIME_BASED_CONTENT = {
  morning: {
    greeting: (name) => `Good Morning, ${name}`,
    quote: "Start your day with a fresh goal.",
    icon: "sun"
  },
  afternoon: {
    greeting: (name) => `Good Afternoon, ${name}`,
    quote: "Keep going, you're making progress.",
    icon: "sun-medium"
  },
  evening: {
    greeting: (name) => `Good Evening, ${name}`,
    quote: "Great work today. Keep learning.",
    icon: "sunset"
  },
  night: {
    greeting: (name) => `Good Night, ${name}`,
    quote: "Rest well and prepare for tomorrow.",
    icon: "moon"
  }
};

/**
 * Returns greeting and quote object based on current hour of day
 * @param {string} name 
 * @param {Date} date 
 * @returns {{ greeting: string, quote: string, timePeriod: string, icon: string }}
 */
export const getTimeBasedGreeting = (name = 'User', date = new Date()) => {
  const hour = date.getHours();

  let period;
  if (hour >= 4 && hour < 12) {
    period = 'morning';
  } else if (hour >= 12 && hour < 17) {
    period = 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    period = 'evening';
  } else {
    period = 'night';
  }

  const content = TIME_BASED_CONTENT[period];
  const displayName = name ? name.trim() : 'User';

  return {
    greeting: content.greeting(displayName),
    quote: content.quote,
    timePeriod: period,
    icon: content.icon
  };
};
