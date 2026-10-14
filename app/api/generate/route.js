import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, style } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'יש לספק הנחיה (פרומפט)' }, { status: 400 });
    }

    const enhancedPrompt = `${prompt}, high quality, ${style} style`;
    
    return NextResponse.json({ 
      success: true, 
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
      promptUsed: enhancedPrompt
    });

  } catch (error) {
    return NextResponse.json({ error: 'שגיאה בעיבוד הבקשה בשרת' }, { status: 500 });
  }
}
