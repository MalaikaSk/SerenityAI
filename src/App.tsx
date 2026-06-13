import { useState, useEffect, FormEvent } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Sparkles, 
  HelpCircle, 
  Compass, 
  Heart, 
  ArrowRight, 
  RefreshCw, 
  Volume2, 
  Info, 
  CheckCircle2, 
  Send,
  CloudLightning,
  Sun,
  MapPin,
  Clock,
  Wind,
  Moon,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { SerenityResponse, GuidanceOption } from "./types";

let isImageGenSuspended = false;
let suspensionExpiresAt = 0;

function getFallbackImage(prompt: string, emotion: string): string {
  const p = (prompt + " " + emotion).toLowerCase();
  
  // Extract clean keywords from the prompt to get a gorgeous fitting Unsplash image
  const cleanTokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !["photorealistic", "realistic", "scenic", "calming", "tranquil", "nature", "landscape", "cinematic", "composition", "widescreen", "view", "views", "breaking", "with", "after", "through"].includes(word)
    );
  
  if (cleanTokens.length > 0) {
    const keywords = [...cleanTokens.slice(0, 3), "nature", "tranquil"].join(",");
    return `https://images.unsplash.com/featured/1600x900/?${encodeURIComponent(keywords)}`;
  }

  if (p.includes("mountain") || p.includes("sunrise") || p.includes("peak") || p.includes("hill")) {
    return "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80"; // Mountain sunrise
  }
  if (p.includes("forest") || p.includes("tree") || p.includes("wood") || p.includes("pathway") || p.includes("trail") || p.includes("green")) {
    return "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80"; // Forest path
  }
  if (p.includes("ocean") || p.includes("sea") || p.includes("beach") || p.includes("horizon") || p.includes("wave") || p.includes("water")) {
    return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"; // Ocean beach
  }
  if (p.includes("river") || p.includes("stream") || p.includes("waterfall") || p.includes("lake") || p.includes("flow")) {
    return "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80"; // Flowing river
  }
  if (p.includes("flower") || p.includes("bloom") || p.includes("meadow") || p.includes("rain") || p.includes("garden") || p.includes("petal")) {
    return "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1200&q=80"; // Meadows/Flowers
  }
  
  // Choose dynamically based on an index if nothing matches
  const fallbacks = [
    "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80", // Sun rays forest
    "https://images.unsplash.com/photo-1472214222541-d510753a4707?auto=format&fit=crop&w=1200&q=80", // Peaceful field
    "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=1200&q=80"  // Serene woods
  ];
  return fallbacks[Math.abs(p.length) % fallbacks.length];
}

const SUGGESTIONS = [
  { text: "I feel completely exhausted and burnt out from work.", label: "Exhausted 😫" },
  { text: "I am extremely anxious about my upcoming exams and future.", label: "Exam Anxiety 📚" },
  { text: "I feel lost, confused, and unmotivated lately.", label: "Unmotivated 🪵" },
  { text: "I am paralyzed by the fear of failing at my dreams.", label: "Fear of Failure ⚡" },
  { text: "I feel peaceful but need structured guidance for today.", label: "Seeking Guidance 🌱" }
];

const GUIDANCE_PERSPECTIVES: { value: GuidanceOption; description: string; icon: string; color: string }[] = [
  { 
    value: "General Wisdom", 
    description: "Stoicism, Buddhist mindfulness, and timeless secular philosophy.", 
    icon: "☯️",
    color: "from-teal-400 to-indigo-500"
  },
  { 
    value: "Islamic Reflection", 
    description: "Insights from Islamic Quranic ease, Rumi's poetry, and Al-Ghazali's heart-calming Sufism.", 
    icon: "🕌",
    color: "from-emerald-400 to-teal-500"
  },
  { 
    value: "Christian Reflection", 
    description: "Comforting Psalms, grace-filled New Testament teachings, and divine inner peace.", 
    icon: "✝️",
    color: "from-indigo-400 to-violet-500"
  },
  { 
    value: "Hindu Reflection", 
    description: "Bhagavad Gita's detachment from results, the eternal radiant soul, and Upanishad calm.", 
    icon: "🕉️",
    color: "from-amber-400 to-orange-500"
  }
];

export default function App() {
  const [feeling, setFeeling] = useState("");
  const [guidanceType, setGuidanceType] = useState<GuidanceOption>("General Wisdom");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<SerenityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Pause">("Inhale");
  const [breathingTimer, setBreathingTimer] = useState(4);

  // Breathing simulation loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBreathingActive) {
      interval = setInterval(() => {
        setBreathingTimer((prev) => {
          if (prev <= 1) {
            // Transition and reset phases based on 4-7-8 breathing technique
            if (breathingPhase === "Inhale") {
              setBreathingPhase("Hold");
              return 7;
            } else if (breathingPhase === "Hold") {
              setBreathingPhase("Exhale");
              return 8;
            } else if (breathingPhase === "Exhale") {
              setBreathingPhase("Inhale");
              return 4;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBreathingActive, breathingPhase]);

  // Loading steps animation simulated steps
  useEffect(() => {
    let stepInterval: NodeJS.Timeout;
    if (loading) {
      stepInterval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(stepInterval);
  }, [loading]);

  const handleSuggest = (text: string) => {
    setFeeling(text);
  };

  const handleFindPeace = async (e: FormEvent) => {
    e.preventDefault();
    if (!feeling.trim()) {
      setError("Please put into words how you are feeling today.");
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep(0);

    try {
      const meta = import.meta as any;
      const apiKey = (meta.env && (meta.env.VITE_GEMINI_API_KEY || meta.env.GEMINI_API_KEY)) || (typeof process !== "undefined" && (process.env as any)?.GEMINI_API_KEY) || "";
      
      if (!apiKey) {
        throw new Error("VITE_GEMINI_API_KEY is missing. Pls add VITE_GEMINI_API_KEY as an environment variable in your Vercel project settings or local .env file.");
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const selectedGuidance = guidanceType || "General Wisdom";

      const systemInstruction = `You are Serenity AI, an empathetic emotional wellness guide and multi-faith spiritual philosopher.
Your goal is to provide deep comforting perspective, philosophical validation, and calm next steps for people in distress.
You analyze the user's feelings and respond under their chosen philosophical/spiritual theme:
- 'General Wisdom': Stoicism, Buddhism, Transcendentalism, or modern therapeutic wisdom. Warm, secular, and gentle.
- 'Islamic Reflection': Beautiful scriptures (Quran, Hadith) or Sufi scholar wisdom (e.g. Rumi, Al-Ghazali) focusing on hope (Ease after Hardship / Sabr / Mercy).
- 'Christian Reflection': Warm scripture passages (Psalms, New Testament) or timeless Christian writings (C.S. Lewis, Augustine) focused on inner peace, grace, resting the weary soul, and faith.
- 'Hindu Reflection': Classical scriptures (Bhagavad Gita, Upanishads) or teachings of Swami Vivekananda focusing on selflessness (Karma Yoga), the eternal divinity within (Atman), and peace beyond earthly storms.

Create a profoundly comforting response that validates the user's emotion without offering medical advice.
Keep instructions inside quotes matching historical context.
Return the output structured STRICTLY in JSON according to the schema.`;

      const serenitySchema = {
        type: Type.OBJECT,
        properties: {
          primaryEmotion: {
            type: Type.STRING,
            description: "A single word or very short phrase representing the primary emotion identified (e.g., Anxiety, Burnout, Grief, Uncertainty)."
          },
          intensity: {
            type: Type.STRING,
            description: "Analyzed emotional intensity (e.g., High, Moderate, Low)."
          },
          rootCause: {
            type: Type.STRING,
            description: "Suspected root cause of the state based on context (e.g., Academic stress, Fatigue, Self-expectation, Life transition)."
          },
          emotionSummary: {
            type: Type.STRING,
            description: "A kind, deeply validating summary showing you truly understand their experience (2-3 sentences)."
          },
          wisdomQuote: {
            type: Type.STRING,
            description: "A powerful, comforting, and authentic quote representing the chosen perspective. Must align with General, Islamic, Christian, or Hindu traditions."
          },
          wisdomSource: {
            type: Type.STRING,
            description: "The source or author of the quote (e.g., Quran 94:6, Matthew 11:28, Bhagavad Gita 2:47, Marcus Aurelius)."
          },
          historicalContext: {
            type: Type.STRING,
            description: "A professional, deeply comforting explanation of the historical or spiritual context behind the wisdom, and how it has served as an anchor for humanity across generations (3-4 sentences)."
          },
          personalizedReflection: {
            type: Type.STRING,
            description: "Profoundly comforting socratic reflection direct to the user. Speak with warmth; reframe their worries into peaceful guidance and resilience (3-5 sentences)."
          },
          nextSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly three practical, short, compassionate action-oriented next steps that are physically grounding or mentally calming."
          },
          encouragement: {
            type: Type.STRING,
            description: "Gentle final comforting encouragement of reassurance (1-2 sentences)."
          },
          natureImagePrompt: {
            type: Type.STRING,
            description: "A descriptive realistic landscape image prompt that represents a journey to calm (e.g., forest path, sun rays breaking, ocean skyline, quiet mountain sunrise, flowers wet with dew)."
          }
        },
        required: [
          "primaryEmotion",
          "intensity",
          "rootCause",
          "emotionSummary",
          "wisdomQuote",
          "wisdomSource",
          "historicalContext",
          "personalizedReflection",
          "nextSteps",
          "encouragement",
          "natureImagePrompt"
        ]
      };

      const contents = `Analyze emotional state: "${feeling}" using guidance theme option: "${selectedGuidance}"`;

      // Request structured output
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: serenitySchema,
        }
      });

      if (!response.text) {
        throw new Error("No response received from the reflection engine.");
      }

      const report = JSON.parse(response.text);

      // Now, attempt to generate the calming nature image using image generation model
      let imageBase64 = "";
      const shouldAttemptImageGen = !isImageGenSuspended || Date.now() > suspensionExpiresAt;

      if (shouldAttemptImageGen) {
        try {
          const imgResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                {
                  text: `Photorealistic high resolution scenic calming tranquil nature landscape: ${report.natureImagePrompt}. Serene atmospheric lighting, high dynamic range, stunning view, cinematic composition, widescreen 16:9.`,
                }
              ]
            },
            config: {
              imageConfig: {
                aspectRatio: "16:9"
              }
            }
          });

          if (imgResponse?.candidates?.[0]?.content?.parts) {
            for (const part of imgResponse.candidates[0].content.parts) {
              if (part.inlineData) {
                imageBase64 = `data:image/png;base64,${part.inlineData.data}`;
                isImageGenSuspended = false;
                break;
              }
            }
          }
        } catch (imgErr: any) {
          const errString = String(imgErr).toLowerCase() + " " + JSON.stringify(imgErr).toLowerCase();
          
          if (errString.includes("429") || errString.includes("quota") || errString.includes("exhausted") || errString.includes("rate-limits") || errString.includes("limit")) {
            console.warn("[Serenity AI] Quota exceeded on Image Generator, activating circuit-breaker suspension for 10 mins.");
            isImageGenSuspended = true;
            suspensionExpiresAt = Date.now() + 10 * 60 * 1000;
          } else {
            console.warn("[Serenity AI] Image generation failed temporarily:", imgErr);
          }
        }
      }

      const finalImage = imageBase64 || getFallbackImage(report.natureImagePrompt, report.primaryEmotion);

      setResult({
        ...report,
        imageUrl: finalImage,
        isAiGeneratedImage: !!imageBase64
      });

    } catch (err: any) {
      setError(err.message || "Failed to reach peace engine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStepText = () => {
    switch (loadingStep) {
      case 0: return "Analyzing your emotional expression with empathy...";
      case 1: return "Unearthing timeless philosophical anchors and scriptures...";
      case 2: return "Crafting high-fidelity calming panoramic sanctuary visual...";
      case 3: return "Fine-tuning practical restorative steps and gentle guidance...";
      default: return "Summoning quiet energy into your present space...";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-h-screen px-4 py-6 md:py-10 flex flex-col justify-between relative text-slate-100">
      
      {/* Background Decorative Ambient Blurs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-15%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-indigo-600/10 rounded-full blur-[130px]"></div>
        <div className="absolute bottom-[20%] right-[-15%] w-[500px] md:w-[700px] h-[500px] md:h-[700px] bg-teal-500/10 rounded-full blur-[130px]"></div>
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-sky-500/5 rounded-full blur-[100px]"></div>
      </div>

      {/* Main Header / Navigation */}
      <header className="mb-8 md:mb-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-teal-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/15">
            <Compass className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight text-white font-serif">Serenity AI</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Premium
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Your sanctuary for reflection, ancient wisdom, and quiet perspective</p>
          </div>
        </div>

        {/* Quick Tools & Context */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsBreathingActive(!isBreathingActive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 border ${
              isBreathingActive 
                ? "bg-teal-500/20 border-teal-400 text-teal-300" 
                : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            <Wind className="w-4 h-4 animate-spin-slow" />
            {isBreathingActive ? `Breathing: ${breathingPhase} (${breathingTimer}s)` : "Breathing Exercise"}
          </button>
          
          <div className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
            Engine Ready
          </div>
        </div>
      </header>

      {/* Breathing Guide Drawer (When Active) */}
      {isBreathingActive && (
        <div className="mb-6 p-5 rounded-[2rem] bg-teal-950/10 border border-teal-500/20 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
              breathingPhase === "Inhale" ? "border-teal-400 bg-teal-400/10 scale-110" :
              breathingPhase === "Hold" ? "border-amber-400 bg-amber-400/10 scale-100" :
              "border-indigo-400 bg-indigo-400/10 scale-95"
            } transition-all duration-700 ease-in-out`}>
              <Wind className="w-7 h-7 text-teal-300" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-white font-medium">4-7-8 Deep Grounding Loop</h3>
              <p className="text-xs text-slate-300 mt-1">
                {breathingPhase === "Inhale" && "Breath in through your nose gently, feeling your belly expand."}
                {breathingPhase === "Hold" && "Hold the breath quietly, anchoring your focus on stillness."}
                {breathingPhase === "Exhale" && "Exhale completely through your mouth, letting all muscle tension dissolve."}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 uppercase tracking-widest block">Current State</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">{breathingPhase} • {breathingTimer}s</span>
            </div>
            <button 
              onClick={() => setIsBreathingActive(false)}
              className="px-4 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
            >
              Quiet Exercise
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Input Sidebar Panel */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col gap-6 relative shadow-2xl">
            
            {/* Header context */}
            <div>
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block mb-1">Emotion Companion</span>
              <h2 className="text-2xl font-serif text-white font-semibold">How is your heart today?</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Describe your feelings without filter. Select the philosophical guidance that resonates with you to generate custom wisdom.
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleFindPeace} className="flex flex-col gap-6">
              
              {/* Text Area */}
              <div className="space-y-2">
                <label htmlFor="feeling" className="text-xs font-bold uppercase tracking-widest text-teal-400 flex items-center justify-between">
                  <span>Your Emotional State</span>
                  <span className="text-[10px] text-slate-500 normal-case">be as descriptive as you wish</span>
                </label>
                <div className="relative">
                  <textarea 
                    id="feeling"
                    value={feeling}
                    onChange={(e) => setFeeling(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    className="w-full bg-slate-950/40 border border-white/10 rounded-2xl p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 focus:outline-none transition-all leading-relaxed resize-none"
                    placeholder="E.g., I feel exhausted, everything feels like a burden and my motivation is declining..."
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-slate-500">
                    {feeling.length}/1000
                  </div>
                </div>
              </div>

              {/* Suggestions Chips */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Quick Prompts</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggest(s.text)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                        feeling === s.text 
                        ? "bg-teal-500/20 border-teal-400 text-teal-300 font-medium"
                        : "bg-slate-900/40 border-white/5 hover:border-slate-500 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Faith/Secular Guidance Dropdown */}
              <div className="space-y-2.5">
                <label htmlFor="guidance" className="text-xs font-bold uppercase tracking-widest text-teal-400">
                  Path of Guidance
                </label>
                
                <div className="grid grid-cols-1 gap-2">
                  <select 
                    id="guidance"
                    value={guidanceType}
                    onChange={(e) => setGuidanceType(e.target.value as GuidanceOption)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30 focus:outline-none transition-all cursor-pointer"
                  >
                    {GUIDANCE_PERSPECTIVES.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-100">
                        {opt.icon} {opt.value}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Active Guidance Description */}
                <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-2.5 items-start">
                  <BookOpen className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {GUIDANCE_PERSPECTIVES.find(g => g.value === guidanceType)?.description}
                  </p>
                </div>
              </div>

              {/* Find Peace Action Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 disabled:from-teal-700 disabled:to-indigo-800 text-white font-semibold rounded-2xl shadow-xl shadow-teal-500/10 hover:shadow-teal-400/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Summoning Light...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Find Peace</span>
                  </>
                )}
              </button>
            </form>
            {/* Elegant and highly polished informational ribbon built directly into the form container */}
            <div className="mt-6 pt-5 border-t border-white/10 flex gap-3 items-start text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-200">Reflective Companion Notice:</strong> Serenity provides historical spiritual reflections. It does not provide clinical therapy or medical advice.
              </p>
            </div>

          </div>
        </section>

        {/* Right Dynamic Output Display Area */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Default State Empty Room */}
          {!loading && !result && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 text-center flex flex-col items-center justify-center gap-6 min-h-[450px]">
              <div className="w-20 h-20 rounded-full bg-slate-900/60 border border-white/15 flex items-center justify-center shadow-inner">
                <Sun className="w-10 h-10 text-teal-400 animate-spin-slow" />
              </div>
              
              <div className="max-w-md space-y-2">
                <h3 className="text-2xl font-serif text-white font-medium">Fill the space with your thoughts</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Deeply describe your present anxiety, fatigue, or stress. Select your philosophical orientation from the list and find dynamic solace.
                </p>
              </div>

              {/* Sample Feeling Seed Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mt-2 text-left w-full">
                <div onClick={() => { setFeeling("Currently feeling hyper-anxious about meeting tight engineering deadlines and afraid I might fall short."); setGuidanceType("General Wisdom"); }} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-teal-500/30 transition-all cursor-pointer">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-teal-400">Stoic & Mindful</span>
                    <span>⌛</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2">"Feeling hyper-anxious about meeting tight engineering deadlines..."</p>
                </div>

                <div onClick={() => { setFeeling("Lately, I feel completely detached, uninspired, and lost. Unsure if my efforts have any actual purpose."); setGuidanceType("Hindu Reflection"); }} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-indigo-400">Atman / Duty</span>
                    <span>🕉️</span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2">"Lately, I feel completely detached, uninspired, and lost..."</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading Transition Sanctuary Screen */}
          {loading && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-8 min-h-[500px] text-center transition-all duration-300">
              <div className="relative flex items-center justify-center w-28 h-28">
                {/* Simulated cosmic breathing ring */}
                <div className="absolute inset-0 border-2 border-dashed border-teal-400/40 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-2 border-teal-500/20 rounded-full animate-ping"></div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
                  <Wind className="w-8 h-8 text-white" />
                </div>
              </div>

              <div className="space-y-4 max-w-md">
                <h3 className="text-xl font-serif text-white tracking-wide">Seeking Peaceful Guidance</h3>
                <p className="text-sm font-medium text-teal-300 animate-pulse min-h-[20px]">
                  {getStepText()}
                </p>
                <div className="w-48 h-1 bg-slate-900 rounded-full mx-auto overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${((loadingStep + 1) / 4) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-center gap-1.5 pt-2">
                  {[0, 1, 2, 3].map((s) => (
                    <div 
                      key={s} 
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${s <= loadingStep ? 'bg-teal-400 scale-125' : 'bg-white/10'}`}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Gentle breathing placeholder loop for user to relax while waiting */}
              <div className="pt-4 border-t border-white/5 w-full max-w-sm mt-4">
                <p className="text-xs text-slate-400 italic">"While we coordinate your reflection, let your shoulders drop and take a long, deliberate breath."</p>
              </div>
            </div>
          )}

          {/* Error Solace Display */}
          {error && !loading && (
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-3xl p-6 flex gap-4 items-start text-xs text-rose-200">
              <CloudLightning className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold mb-1">A brief storm in the connection</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Calming Solace Sanctuary Output Results */}
          {result && !loading && (
            <div className="space-y-6 animate-fadeIn">

              {/* Grid block cards container matching Frosted Glass mock template */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Card 1: Emotion Summary */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[1.8rem] p-6 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Emotion Summary</span>
                      <div className="flex gap-1.5">
                        <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          {result.intensity} Intensity
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-serif font-medium text-white mb-2">
                      Identified: <span className="text-teal-300">{result.primaryEmotion}</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {result.emotionSummary}
                    </p>
                  </div>
                  
                  {result.rootCause && (
                    <div className="pt-3 border-t border-white/5 text-[11px] text-slate-400">
                      <span className="block text-[9px] text-slate-500 uppercase font-mono tracking-wider">Potential Trigger</span>
                      {result.rootCause}
                    </div>
                  )}
                </div>

                {/* Card 2: Timeless Anchor */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[1.8rem] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
                  <div className="absolute top-2 right-4 text-6xl text-slate-800 font-serif pointer-events-none select-none">“</div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-4">Timeless Anchor</span>
                    <p className="text-sm md:text-base italic text-slate-100 font-serif tracking-wide leading-relaxed mb-4">
                      {result.wisdomQuote}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs font-serif text-teal-300 font-medium">
                      {result.wisdomSource}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Perspective Source</p>
                  </div>
                </div>

                {/* Card 3: Historic Context */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[1.8rem] p-6 flex flex-col justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-3">Historic Context</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {result.historicalContext}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Philosophical Lineage</div>
                  </div>
                </div>

                {/* Card 4: Personalized Reflection */}
                <div className="md:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block mb-3">Personalized Reflection</span>
                    <p className="text-sm md:text-base text-slate-200 font-serif leading-relaxed italic">
                      {result.personalizedReflection}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-400 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                    <span>An tailored meditative guide aligned to your personal state.</span>
                  </div>
                </div>

                {/* Card 5: Encouragement */}
                <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/25 rounded-[1.8rem] p-6 flex flex-col justify-center text-center relative overflow-hidden shadow-lg">
                  <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-indigo-500/10 to-transparent"></div>
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1.5 block">Encouragement</span>
                  <p className="text-base font-serif text-white font-medium leading-snug">
                    {result.encouragement}
                  </p>
                  <p className="text-[11px] text-indigo-200 mt-3 italic">
                    Let this settle into your heart. Breathe deep.
                  </p>
                </div>

                {/* Card 6: Next Steps (Emoji cards) */}
                <div className="md:col-span-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Restoration Path</span>
                      <h3 className="text-xl font-serif text-white font-medium">Simple Paths to Calm</h3>
                      <p className="text-xs text-slate-400">No complex checklists. Just simple sensory anchors designed for rest.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setFeeling("");
                        setResult(null);
                      }}
                      className="self-start sm:self-center px-4 py-2 rounded-xl text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-all font-medium"
                    >
                      Examine New Emotion &larr;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-white/3 border border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-all group">
                      <span className="text-4xl mb-3 animate-pulse group-hover:scale-110 transition-transform">🧘</span>
                      <h4 className="text-xs font-semibold text-white">Quiet Breath</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Inhale for 4s, hold for 7s, exhale for 8s</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/3 border border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-all group">
                      <span className="text-4xl mb-3 animate-pulse group-hover:scale-110 transition-transform">🍵</span>
                      <h4 className="text-xs font-semibold text-white">Mindful Sip</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Warm tea or cool water enjoyed slowly</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-white/3 border border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-all group">
                      <span className="text-4xl mb-3 animate-pulse group-hover:scale-110 transition-transform">🌿</span>
                      <h4 className="text-xs font-semibold text-white">Sensory Space</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Look away from screen, ground your shoulders</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </section>

      </main>

      {/* Footer Navigation bar matching requested style */}
      <footer className="mt-12 md:mt-16 border-t border-white/5 pt-6 pb-2 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p>© 2026 Serenity AI — Multi-Faith Emotional Intelligence Companion</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Built using Google Gemini 3.5 & real-time scenic Generation model. Crafted with deep spiritual lineage.
          </p>
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-medium">
          <span className="hover:text-white transition-colors cursor-pointer">Guided Reflections</span>
          <span>•</span>
          <span className="hover:text-white transition-colors cursor-pointer">Sufi, Stoic, Christian & Gita Wisdom</span>
        </div>
      </footer>
    </div>
  );
}
