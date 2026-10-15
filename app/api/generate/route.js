import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. קרא את הבקשה מהלקוח
    const { prompt, style } = await request.json();

    // 2. וודא שיש פרומפט
    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: 'יש לספק הנחיה (פרומפט) חוקית.' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'חסר מפתח API של Replicate בשרת.' }, { status: 500 });
    }

    // 3. בניית הפרומפט הסופי - הנה השינוי המרכזי! 
    // חשוב מאוד להעביר את הפרומפט המדויק כפי שהוא התקבל.
    const finalPromptForGeneration = `${prompt}, ${style} style`;

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
          // הנה השינוי: הפרומפט שנשלח למודל הוא בדיוק מה שהקלדת בתוספת הסגנון
          prompt: finalPromptForGeneration,
          aspect_ratio: "1:1",
          output_format: "webp",
          // כדי לקבל דיוק מקסימלי, נוסיף הגדרה ללא שליליות אם המודל תומך
          // (בשלב זה נשאיר את זה ככה כדי לא לסבך)
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
    for (let i = 0; i < 20; i++) { // הגדלנו את מספר הניסיונות ליתר ביטחון
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
      await new Promise(res => setTimeout(res, 1000)); // המתנה של שנייה בין בדיקות
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'זמן ההמתנה ליצירת התמונה פג. נסה שוב.' }, { status: 500 });
    }

    // 6. החזרת התמונה המוצלחת ללקוח
    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl,
      // נחזיר גם את הפרומפט ששימש ליצירה כדי לוודא שזה תקין
      promptUsed: finalPromptForGeneration
    });

  } catch (error) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: 'שגיאה חמורה בעיבוד השרת. אנא נסה מאוחר יותר.' }, { status: 500 });
  }
}
