// Rule-based fallback enhancer (old behaviour), returns 3 suggestions.
export function ruleEnhance(prompt, intensity = 'bold') {
  const p = (prompt || '').trim() || 'A stunning scene';
  const t = p.toLowerCase();
  let base;
  if (/(car|vehicle|bike)/.test(t)) base = 'dynamic motion shot, glossy metallic reflections, wet asphalt, automotive commercial lighting';
  else if (/(portrait|man|woman|face|person)/.test(t)) base = 'professional portrait photography, detailed skin texture, soft natural light, shallow depth of field';
  else if (/(cyberpunk|neon|future)/.test(t)) base = 'glowing neon reflections, volumetric fog, moody atmospheric lighting, futuristic details';
  else if (/(nature|forest|mountain|animal)/.test(t)) base = 'wildlife photography, hyper-realistic textures, morning sunlight, breathtaking environment';
  else base = 'highly detailed composition, volumetric lighting, rich textures, award-winning visual depth';
  const extra = { subtle: ['clean composition', 'soft light', 'gentle color grading'],
    bold: ['dramatic lighting', 'cinematic color palette', 'striking perspective'],
    wild: ['surreal dreamlike twist', 'impossible architecture', 'explosive iridescent colors'] }[intensity] || [];
  return extra.map((e) => `${p}, ${base}, ${e}`);
}
