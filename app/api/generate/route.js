import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, style } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'יש לספק הנחיה (פרומפט)' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'חסר מפתח API של Replicate בשרת' }, { status: 500 });
    }

    const enhancedPrompt = `${prompt}, high quality, ${style} style`;

    // שליחת בקשה למודל Flux.1-schnell של Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "f48c3b169542a2202613eb5da23270929fa3a992fbcc5703f8303e33c69022e3", // Flux.1-schnell
        input: {
          prompt: enhancedPrompt,
          aspect_ratio: "1:1",
          output_format: "webp"
        }
      })
    });

    const prediction = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: prediction.detail || 'שגיאה بالتواصل עם מנוע ה-AI' }, { status: 500 });
    }

    // המתנה לתוצאה מ-Replicate ( בלوب פשוט או קבלת ה-URL הראשוני אם מדובר בסינכרון)
    let imageUrl = null;
    let getUrl = prediction.urls?.get;

    // לולאת המתנה לקבלת התמונה הסופית
    for (let i = 0; i < 10; i++) {
      if (!getUrl) break;
      const statusRes = await fetch(getUrl, {
        headers: { "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}` }
      });
      const statusData = await statusRes.json();
      
      if (statusData.status === "succeeded") {
        imageUrl = statusData.output[0];
        break;
      } else if (statusData.status === "failed") {
        break;
      }
      // המתנה של שנייה וחצי בין בדיקות
      await new Promise(res => setTimeout(res, 1500));
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'זמן ההמתנה ליצירת התמונה פג' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      promptUsed: enhancedPrompt
    });

  } catch (error) {
    return NextResponse.json({ error: 'שגיאה חמורה בעיבוד השרת' }, { status: 500 });
  }
}
