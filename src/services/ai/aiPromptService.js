function getChatSystemPrompt() {
  return (
    'Bạn là Emi — người bạn chữa lành tinh thần trong ứng dụng EMOORI.\n' +
    'Nhiệm vụ: phản hồi nhẹ nhàng, đồng cảm, giúp người dùng tự quan sát cảm xúc, gợi ý hoạt động lành mạnh.\n' +
    'Không đưa lời khuyên y tế nguy hiểm, không chẩn đoán bệnh.\n' +
    'Nếu có dấu hiệu tự hại/khủng hoảng: ưu tiên phản hồi an toàn, khuyên tìm người thân/chuyên gia.\n' +
    '\n' +
    'Bắt buộc trả về JSON hợp lệ (không markdown, không text ngoài JSON) theo schema:\n' +
    '{\n' +
    '  "reply": string,\n' +
    '  "detectedEmotion": "sad"|"anxious"|"angry"|"happy"|"neutral"|"stressed"|"tired"|"excited"|"calm"|"other",\n' +
    '  "emotionScore": number (0-100),\n' +
    '  "suggestions": string[],\n' +
    '  "recommendedActions": ("breathing"|"journal"|"music"|"rest"|"walk"|"gratitude"|"talk_to_friend")[]\n' +
    '}\n' +
    '\n' +
    'Quy tắc:\n' +
    '- reply tối đa ~5-8 câu, ngắn gọn, ấm áp.\n' +
    '- suggestions 2-4 gợi ý cụ thể, dễ làm.\n' +
    '- emotionScore ước lượng tương đối.\n'
  );
}

function getImagePrompt(style, extraNote) {
  const styleName = String(style?.name || '').trim();
  const template = String(style?.promptTemplate || '').trim();
  const note = String(extraNote || '').trim();

  const base =
    template ||
    `Transform the person portrait into the style: ${styleName}. Soft pastel colors, gentle lighting, calming mood.`;

  if (!note) return base;
  return `${base}\nAdditional user note: ${note}`;
}

function getDefaultStyles() {
  return [
    {
      name: 'Anime',
      description: 'Phong cách anime mềm mại, pastel nhẹ nhàng.',
      previewImage: '',
      promptTemplate:
        'Anime portrait, soft pastel palette, clean line art, gentle highlights, dreamy background, calming mood.',
      type: 'free',
      isActive: true
    },
    {
      name: 'Fantasy',
      description: 'Huyền ảo, ánh sáng lung linh.',
      previewImage: '',
      promptTemplate:
        'Fantasy portrait, magical lighting, ethereal particles, dreamy atmosphere, cinematic color grading.',
      type: 'free',
      isActive: true
    },
    {
      name: 'Ghibli',
      description: 'Cảm hứng hoạt hình ấm áp, nền thiên nhiên dịu.',
      previewImage: '',
      promptTemplate:
        'Cozy hand-painted animation style portrait, warm tones, soft shading, scenic nature background, whimsical and comforting.',
      type: 'premium_plus',
      isActive: true
    },
    {
      name: 'Cyberpunk',
      description: 'Neon cyberpunk, tương phản cao nhưng vẫn mượt.',
      previewImage: '',
      promptTemplate:
        'Cyberpunk portrait, neon lighting, futuristic city bokeh, high contrast but clean, stylish and sharp details.',
      type: 'premium',
      isActive: true
    },
    {
      name: 'Disney',
      description: 'Hoạt hình dễ thương, ánh sáng trong trẻo.',
      previewImage: '',
      promptTemplate:
        'Cute animated portrait, big expressive eyes, clean smooth shading, bright friendly colors, uplifting mood.',
      type: 'premium',
      isActive: true
    },
    {
      name: 'Watercolor',
      description: 'Màu nước mềm, texture giấy, nhẹ nhàng.',
      previewImage: '',
      promptTemplate:
        'Watercolor portrait, soft brush strokes, paper texture, gentle color bleeding, calm atmosphere.',
      type: 'free',
      isActive: true
    },
    {
      name: 'Photorealistic',
      description: 'Tăng độ chân thực, ánh sáng studio.',
      previewImage: '',
      promptTemplate:
        'Photorealistic portrait enhancement, natural skin tones, studio lighting, high detail, shallow depth of field.',
      type: 'premium',
      isActive: true
    }
  ];
}

module.exports = {
  getChatSystemPrompt,
  getImagePrompt,
  getDefaultStyles
};
