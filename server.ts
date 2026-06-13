import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
  
  // Choose dynamically based on a index if nothing matches
  const fallbacks = [
    "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80", // Sun rays forest
    "https://images.unsplash.com/photo-1472214222541-d510753a4707?auto=format&fit=crop&w=1200&q=80", // Peaceful field
    "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?auto=format&fit=crop&w=1200&q=80"  // Serene woods
  ];
  return fallbacks[Math.abs(p.length) % fallbacks.length];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for emotional reflection and calming image generation
  app.post("/api/serenity", async (req, res) => {
    try {
      const { feeling, guidanceType } = req.body;

      if (!feeling || typeof feeling !== "string" || feeling.trim().length === 0) {
        return res.status(400).json({ error: "Please tell us how you are feeling." });
      }

      const selectedGuidance = guidanceType || "General Wisdom";

      // Build context & guidelines
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
                // Successful generation; reset suspension state if any
                isImageGenSuspended = false;
                break;
              }
            }
          }
        } catch (imgErr: any) {
          const errString = String(imgErr).toLowerCase() + " " + JSON.stringify(imgErr).toLowerCase();
          
          // Detect rates or quota violations
          if (errString.includes("429") || errString.includes("quota") || errString.includes("exhausted") || errString.includes("rate-limits") || errString.includes("limit")) {
            console.warn("[Serenity AI] Quota exceeded on Image Generator, activating circuit-breaker suspension for 10 mins.");
            isImageGenSuspended = true;
            suspensionExpiresAt = Date.now() + 10 * 60 * 1000; // Suspend for 10 minutes
          } else {
            console.warn("[Serenity AI] Image generation failed temporarily:", imgErr);
          }
        }
      } else {
        console.log("[Serenity AI] Image generation bypassed via active circuit-breaker (re-routes instantly to Unsplash).");
      }

      // If no AI-generated image, resolve to beautiful high-res calming Unsplash photo suited to prompt
      const finalImage = imageBase64 || getFallbackImage(report.natureImagePrompt, report.primaryEmotion);

      return res.json({
        ...report,
        imageUrl: finalImage,
        isAiGeneratedImage: !!imageBase64
      });

    } catch (err: any) {
      console.error("Error in Serenity processing:", err);
      return res.status(500).json({
        error: err.message || "An error occurred while finding your peace. Please try again."
      });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serenity AI server running on http://localhost:${PORT}`);
  });
}

startServer();
