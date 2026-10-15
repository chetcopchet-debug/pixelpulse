import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, style } = await request.json();

    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: 'יש להזין תיאור לתמונה.' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'חסר מפתח API בשרת.' }, { status: 500 });
    }

    // 1. זיהוי אם הטקסט מכיל עברית ותרגום לאנגלית דרך שירות API אמין וחינמי
    let englishPrompt = prompt.trim();
    const hasHebrew = /[\u0590-\u05FF]/.test(englishPrompt);

    if (hasHebrew) {
      try {
        // ניסיון ראשון: MyMemory Translation API (חינמי ויציב לשרתים)
        const cleanText = englishPrompt.replace(/\n+/g, ' ');
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=he|en`
        );
        const data = await res.json();
        
        if (data?.responseData?.translatedText) {
          englishPrompt = data.responseData.translatedText;
        }
      } catch (err) {
        console.error("Primary translation error:", err);
      }
    }

    // 2. הרכבת הפרומפט הסופי באנגלית עבור מודל Flux
    const finalPrompt = `${englishPrompt}, ${style || 'Cinematic'} style, masterpiece, highly detailed, sharp focus`;

    // 3. שליחת הבקשה ל-Replicate
    const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90
        }
      })
    });

    const prediction = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: prediction.detail || 'שגיאה מול שרת התמונות.' }, { status: 500 });
    }

    let imageUrl = prediction.output ? prediction.output[0] : null;
    let getUrl = prediction.urls?.get;

    // 4. המתנה לתמונה אם היא עדיין בעיבוד
    for (let i = 0; i < 20; i++) {
      if (imageUrl || !getUrl) break;
      await new Promise(res => setTimeout(res, 1000));
      
      const statusRes = await fetch(getUrl, {
        headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
      });
      const statusData = await statusRes.json();
      
      if (statusData.status === "succeeded") {
        imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
        break;
      } else if (statusData.status === "failed") {
        return NextResponse.json({ error: 'יצירת התמונה נכשלה במודל.' }, { status: 500 });
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'תם זמן ההמתנה ליצירת התמונה.' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      translatedPrompt: finalPrompt 
    });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'שגיאה פנימית בשרת.' }, { status: 500 });
  }
}
