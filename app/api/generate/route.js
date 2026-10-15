import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. קרא את הבקשה מהלקוח (הפרומפט והסגנון)
    const { prompt, style } = await request.json();

    // 2. וודא שיש פרומפט
    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: 'יש לספק הנחיה (פרומפט) חוקית.' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'חסר מפתח API של Replicate בשרת.' }, { status: 500 });
    }

    // 3. בניית הפרומפט הסופי - הנה השינוי המרכזי!
    // במקום רק לצרף את הטקסט, אנחנו בונים תיאור מפורט ל-AI.
    // אנחנו נותנים לו הוראות ברורות איך לממש את הבקשה שלך.
    const detailedPrompt = `
      A detailed, high-resolution portrait of a unique anthropomorphic character:
      A realistic human-cat hybrid, with features of a green-furred, humanoid-shaped cat (feline head with human facial structure and proportions),
      dressed in high-detail cinematic attire.
      The character looks 'cruel' (intense, malevolent gaze, perhaps scarred, powerful build) and is surrounded by a soft, radiant, and magical 'aura' (glowing energy particles, soft light emission).
      The style must be ${style}. Include realistic textures, dramatic lighting, and depth of field.
      Original description: ${prompt}
    `;

    // 4. קריאה ל-API של Replicate
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // נשתמש במודל העדכני והמהיר של Flux.1
        version: "black-forest-labs/flux-schnell",
        input: {
          // הנה השינוי: אנחנו שולחים למודל את ה-detailedPrompt שבנינו
          prompt: detailedPrompt,
          aspect_ratio: "1:1",
          output_format: "webp",
          // אם המודל תומך ב-negative prompt, נוסיף כאן כדי להימנע מנופים
          // (כרגע נשאיר את זה ככה כדי לא לסבך את הקריאה)
        }
      })
    });

    const prediction = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: prediction.detail || 'שגיאה בתקשורת עם מנוע ה-AI.' }, { status: 500 });
    }

    let imageUrl = null;
    let getUrl = prediction.urls?.get;

    // 5. לולאת המתנה לקבלת התמונה (Polling)
    for (let i = 0; i < 20; i++) {
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
      await new Promise(res => setTimeout(res, 1000));
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'זמן ההמתנה ליצירת התמונה פג. נסה שוב.' }, { status: 500 });
    }

    // 6. החזרת התמונה המוצלחת ללקוח
    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      // נחזיר גם את הפרומפט ששימש ליצירה כדי לוודא שזה תקין
      promptUsed: detailedPrompt
    });

  } catch (error) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: 'שגיאה חמורה בעיבוד השרת. אנא נסה מאוחר יותר.' }, { status: 500 });
  }
}
