export interface SerenityResponse {
  primaryEmotion: string;
  intensity: string;
  rootCause: string;
  emotionSummary: string;
  wisdomQuote: string;
  wisdomSource: string;
  historicalContext: string;
  personalizedReflection: string;
  nextSteps: string[];
  encouragement: string;
  natureImagePrompt: string;
  imageUrl: string;
  isAiGeneratedImage: boolean;
}

export type GuidanceOption = 'General Wisdom' | 'Islamic Reflection' | 'Christian Reflection' | 'Hindu Reflection';

export interface QuickFeeling {
  emoji: string;
  text: string;
  guidance: GuidanceOption;
}
