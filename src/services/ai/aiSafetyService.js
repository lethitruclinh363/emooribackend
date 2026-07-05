function detectSelfHarmRisk(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;

  const phrases = [
    'tự tử',
    'tu tu',
    'muốn chết',
    'chết đi',
    'tự hại',
    'cắt tay',
    'overdose',
    'kết liễu',
    'không muốn sống',
    'suicide',
    'kill myself',
    'self harm'
  ];

  return phrases.some((p) => t.includes(p));
}

function getSafeCrisisReply() {
  return (
    'Mình rất lo cho bạn lúc này. Nếu bạn đang có ý nghĩ làm hại bản thân hoặc cảm thấy không an toàn, ' +
    'hãy tìm sự hỗ trợ ngay: gọi người thân/bạn bè ở gần, hoặc liên hệ bác sĩ/chuyên gia. ' +
    'Nếu bạn đang trong tình huống khẩn cấp, hãy gọi số cấp cứu tại nơi bạn sống. ' +
    'Bạn không cần phải đối mặt một mình — mình vẫn ở đây để lắng nghe.'
  );
}

module.exports = {
  detectSelfHarmRisk,
  getSafeCrisisReply
};
