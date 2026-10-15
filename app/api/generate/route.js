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

    // 1. תרגום אוטומטי מעברית לאנגלית כדי שמודל ה-AI יבין כל מילה!
    let englishPrompt = prompt;
    try {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(prompt)}`;
      const transRes = await fetch(translateUrl);
      const transData = await transRes.json();
      if (transData && transData[0]) {
        englishPrompt = transData[0].map(item => item[0]).join('');
      }
    } catch (e) {
      console.error("Translation fallback:", e);
    }

    // 2. חיבור הפרומפט המתורגם עם הסגנון האמנותי שנבחר
    const finalPrompt = `${englishPrompt}, ${style || 'Cinematic'} style, high quality, detailed`;

    // 3. שליחה לכתובת הרשמית והישירה של מודל Flux-Schnell ב-Replicate
    const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait" // מבקש מהשרת להמתין ולהחזיר את התמונה המוכנה מיד!
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

    // 4. אם התמונה עוד לא מוכנה מיד, נמתין לה בלולאה
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
