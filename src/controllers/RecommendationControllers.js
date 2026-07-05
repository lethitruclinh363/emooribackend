const Recommendation = require('../model/Recommendation');

const supportedMoods = new Set(['sad', 'anxious', 'angry']);
const supportedTypes = new Set(['advice', 'music', 'activity', 'quote']);

const fallbackRecommendationsByMood = {
    sad: [
        { _id: 'fallback-sad-quote-1', mood: 'sad', type: 'quote', title: 'Nhắc nhỏ', content: 'Bạn không cần phải ổn ngay hôm nay. Chỉ cần đi tiếp từng chút một.' },
        { _id: 'fallback-sad-advice-1', mood: 'sad', type: 'advice', title: 'Tự ôm lấy mình', content: 'Thử gọi tên cảm xúc: “Mình đang buồn.” Hít sâu 3 lần rồi viết ra 3 điều làm bạn thấy nhẹ hơn.' },
        { _id: 'fallback-sad-activity-1', mood: 'sad', type: 'activity', title: 'Việc nhỏ 5 phút', content: 'Uống 1 ly nước, mở cửa sổ, và dọn một góc nhỏ. Hoàn thành việc nhỏ giúp não cảm thấy có kiểm soát.' },
        { _id: 'fallback-sad-music-1', mood: 'sad', type: 'music', title: 'Gợi ý nghe', content: 'Chọn nhạc không lời hoặc lo-fi 10 phút, âm lượng vừa đủ để thở chậm lại.' },
    ],
    anxious: [
        { _id: 'fallback-anxious-advice-1', mood: 'anxious', type: 'advice', title: 'Kéo về hiện tại', content: 'Dùng kỹ thuật 5-4-3-2-1: 5 thứ nhìn thấy, 4 thứ chạm được, 3 thứ nghe thấy, 2 thứ ngửi thấy, 1 thứ nếm được.' },
        { _id: 'fallback-anxious-activity-1', mood: 'anxious', type: 'activity', title: 'Thở 4-7-8', content: 'Hít vào 4s, giữ 7s, thở ra 8s. Lặp lại 4 vòng để nhịp tim hạ dần.' },
        { _id: 'fallback-anxious-quote-1', mood: 'anxious', type: 'quote', title: 'Nhắc nhỏ', content: 'Lo âu thường nói về tương lai. Bạn chỉ cần sống trọn vẹn trong 10 giây kế tiếp.' },
        { _id: 'fallback-anxious-music-1', mood: 'anxious', type: 'music', title: 'Gợi ý nghe', content: 'Âm thanh thiên nhiên (mưa, suối) 10–15 phút giúp giảm căng thẳng.' },
    ],
    angry: [
        { _id: 'fallback-angry-advice-1', mood: 'angry', type: 'advice', title: 'Hạ nhiệt', content: 'Tạm dừng 90 giây. Đặt tay lên ngực, thở ra dài hơn hít vào. Cơn nóng thường giảm nếu bạn không “đổ thêm xăng”.' },
        { _id: 'fallback-angry-activity-1', mood: 'angry', type: 'activity', title: 'Xả năng lượng', content: 'Đi bộ nhanh 5–10 phút hoặc hít đất nhẹ. Chuyển năng lượng cơ thể giúp đầu óc dịu lại.' },
        { _id: 'fallback-angry-quote-1', mood: 'angry', type: 'quote', title: 'Nhắc nhỏ', content: 'Bạn có thể tức giận và vẫn chọn hành động tử tế với chính mình.' },
        { _id: 'fallback-angry-music-1', mood: 'angry', type: 'music', title: 'Gợi ý nghe', content: 'Chọn nhạc tiết tấu vừa, không quá kích thích. Mục tiêu là “ổn định”, không phải “đốt cháy” cảm xúc.' },
    ],
};

exports.getRecommendationsByMood = async (req, res) => {
    try {
        const { mood } = req.params;
        if (!supportedMoods.has(mood)) {
            return res.status(400).json({ message: 'Invalid mood' });
        }

        const recommendations = await Recommendation.find({ mood });
        if (recommendations.length > 0) {
            return res.status(200).json(recommendations);
        }

        return res.status(200).json(fallbackRecommendationsByMood[mood] || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createRecommendation = async (req, res) => {
    try {
        const { mood, title, content, type } = req.body;
        if (!supportedMoods.has(mood) || !supportedTypes.has(type)) {
            return res.status(400).json({ message: 'Invalid mood/type' });
        }
        const newRec = new Recommendation({ mood, title, content, type });
        await newRec.save();
        res.status(201).json(newRec);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getAllRecommendations = async (req, res) => {
    try {
        const recs = await Recommendation.find();
        res.status(200).json(recs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
