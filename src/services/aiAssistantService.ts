import { SUGGESTED_QUESTIONS } from '../data/mockAssistant';

const wait = (ms = 650) => new Promise((resolve) => setTimeout(resolve, ms));

const FALLBACK =
  'I can help with VetLink features and prepare an inquiry for clinic staff. Try one of the suggested questions, or leave an inquiry so clinic staff can follow up.';

/**
 * Mock assistant. Replies are matched on keywords in the question, so the same
 * answer comes back for any phrasing the suggested questions use.
 */
const RULES: { matches: RegExp; answer: string }[] = [
  { matches: /reschedul|move.*appointment|change.*time/, answer: byId('reschedule') },
  { matches: /vaccin|record|medical histor/, answer: byId('records') },
  { matches: /book|appointment|schedule/, answer: byId('book') },
  { matches: /clinic|near ?by|near me|find a vet/, answer: byId('find') },
  { matches: /add.*pet|new pet|my pets/, answer: byId('add_pet') },
  { matches: /account|profile|email|password|log ?in|sign ?in/, answer: byId('account') },
  {
    matches: /urgent|emergency|bleeding|poison|collapse|can’t breathe|cant breathe/,
    answer:
      'For urgent signs like breathing difficulty, bleeding, collapse or suspected poisoning, contact a veterinary clinic directly right away. I can’t assess your pet and this chat isn’t monitored for emergencies.',
  },
];

function byId(id: string) {
  return SUGGESTED_QUESTIONS.find((item) => item.id === id)?.answer ?? FALLBACK;
}

export const aiAssistantService = {
  async reply(prompt: string): Promise<string> {
    await wait();
    const normalized = prompt.toLowerCase();
    return RULES.find((rule) => rule.matches.test(normalized))?.answer ?? FALLBACK;
  },
};
