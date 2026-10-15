import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, style } = await request.json();

    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: 'Please provide a valid prompt.' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'Server configuration error: Missing API Token.' }, { status: 500 });
    }

    const finalPrompt = `${prompt.trim()}, ${style || 'Cinematic'} style, masterpiece, highly detailed, 8k resolution, sharp focus`;

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
      return NextResponse.json({ error: prediction.detail || 'Failed to communicate with AI server.' }, { status: 500 });
    }

    let imageUrl = prediction.output ? prediction.output[0] : null;
    let getUrl = prediction.urls?.get;

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
        return NextResponse.json({ error: 'Image generation failed on the AI model.' }, { status: 500 });
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Generation timed out. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
