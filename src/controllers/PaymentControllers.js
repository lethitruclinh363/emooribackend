const Payment = require('../model/Payment');
const Subscription = require('../model/Subscription');
const User = require('../model/Users');
const crypto = require('crypto');

const supportedPlans = new Set(['premium']);

const formatVnpDate = (date) => {
    // Ép kiểu về giờ Việt Nam (UTC+7)
    const vnTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    const yyyy = vnTime.getUTCFullYear();
    const MM = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getUTCDate()).padStart(2, '0');
    const HH = String(vnTime.getUTCHours()).padStart(2, '0');
    const mm = String(vnTime.getUTCMinutes()).padStart(2, '0');
    const ss = String(vnTime.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
};

const sortObject = (obj) => {
    const sorted = {};
    Object.keys(obj)
        .sort()
        .forEach((key) => {
            sorted[key] = obj[key];
        });
    return sorted;
};

const signVnp = (params, secret) => {
    const sorted = sortObject(params);
    const signData = Object.keys(sorted)
        .map((key) => `${key}=${encodeURIComponent(String(sorted[key])).replace(/%20/g, '+')}`)
        .join('&');
    return crypto.createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
};

const buildQuery = (params) => {
    const sorted = sortObject(params);
    return Object.keys(sorted)
        .map((key) => `${encodeURIComponent(String(key))}=${encodeURIComponent(String(sorted[key])).replace(/%20/g, '+')}`)
        .join('&');
};

exports.createPayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount, method, transactionId } = req.body;

        const newPayment = new Payment({
            userId,
            amount,
            method,
            transactionId,
            status: 'pending'
        });

        await newPayment.save();
        res.status(201).json(newPayment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    try {
        const { transactionId, status } = req.body;
        const payment = await Payment.findOneAndUpdate(
            { transactionId },
            { status },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        res.status(200).json(payment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.createVnpayCheckout = async (req, res) => {
    try {
        console.log('--- Khởi tạo thanh toán VNPay ---');
        const userId = req.user.userId;
        const { plan, durationDays, amount, appReturnUrl } = req.body || {};
        console.log(`User: ${userId}, Plan: ${plan}, Amount: ${amount}`);

        if (!supportedPlans.has(plan)) {
            console.error('Lỗi: Gói không hợp lệ');
            return res.status(400).json({ message: 'Invalid plan' });
        }

        const tmnCode = process.env.VNPAY_TMN_CODE;
        const hashSecret = process.env.VNPAY_HASH_SECRET;
        const vnpUrl = process.env.VNPAY_URL;

        if (!tmnCode || !hashSecret || !vnpUrl) {
            console.error('Lỗi: Thiếu cấu hình VNPay trong .env');
            const missing = [
                !tmnCode ? 'VNPAY_TMN_CODE' : null,
                !hashSecret ? 'VNPAY_HASH_SECRET' : null,
                !vnpUrl ? 'VNPAY_URL' : null,
            ].filter(Boolean);
            return res.status(500).json({ message: `VNPAY chưa được cấu hình (thiếu: ${missing.join(', ')})` });
        }

        if (!appReturnUrl || typeof appReturnUrl !== 'string') {
            return res.status(400).json({ message: 'Missing appReturnUrl' });
        }

        const finalDurationDays = Number(durationDays || 30);
        const finalAmount = Number(amount || 59000);
        if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const txnRef = `${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

        const newPayment = new Payment({
            userId,
            amount: finalAmount,
            method: 'vnpay',
            transactionId: txnRef,
            status: 'pending',
            plan,
            durationDays: finalDurationDays,
        });
        await newPayment.save();
        console.log(`Đã tạo giao dịch tạm: ${txnRef}`);

        const now = new Date();
        let ipAddr = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1');
        if (ipAddr.includes('::ffff:')) {
            ipAddr = ipAddr.replace('::ffff:', '');
        }
        
        // Tự động lấy URL hiện tại của request (ngrok sẽ tự động truyền host qua đây)
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const baseUrl = `${protocol}://${host}`;

        const returnUrl = `${baseUrl}/api/payments/vnpay/return?appReturnUrl=${encodeURIComponent(appReturnUrl)}&durationDays=${encodeURIComponent(String(finalDurationDays))}&plan=${encodeURIComponent(plan)}`;

        const vnpParams = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: tmnCode,
            vnp_Amount: String(Math.round(finalAmount * 100)),
            vnp_CurrCode: 'VND',
            vnp_TxnRef: txnRef,
            vnp_OrderInfo: `Thanh toan nang cap goi ${plan}`,
            vnp_OrderType: 'other',
            vnp_Locale: 'vn',
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: formatVnpDate(now),
        };

        const secureHash = signVnp(vnpParams, hashSecret);
        const paymentUrl = `${vnpUrl}?${buildQuery({ ...vnpParams, vnp_SecureHash: secureHash })}`;

        console.log('URL thanh toán đã tạo:', paymentUrl);
        res.status(200).json({ paymentUrl, transactionId: txnRef });
    } catch (error) {
        console.error('Lỗi createVnpayCheckout:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const processSubscription = async (payment, plan, durationDays) => {
    const userId = payment.userId;
    const finalDurationDays = Number(durationDays || 30);
    const finalPlan = supportedPlans.has(String(plan)) ? String(plan) : 'premium';

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + finalDurationDays);

    const existingActive = await Subscription.findOne({ userId, plan: finalPlan, status: 'active' }).sort({ createdAt: -1 });
    if (!existingActive) {
        const newSubscription = new Subscription({
            userId,
            plan: finalPlan,
            startDate,
            endDate,
            status: 'active',
        });
        await newSubscription.save();
        await User.findByIdAndUpdate(userId, { plan: finalPlan, premiumPlan: finalPlan, isPremium: true });
    }
};

exports.handleVnpayReturn = async (req, res) => {
    try {
        console.log('--- Nhận kết quả từ VNPay (Return URL) ---');
        const { appReturnUrl, durationDays, plan } = req.query || {};
        const tmnCode = process.env.VNPAY_TMN_CODE;
        const hashSecret = process.env.VNPAY_HASH_SECRET;

        if (!tmnCode || !hashSecret) {
            console.error('Lỗi: VNPAY chưa cấu hình');
            return res.status(500).send('VNPAY not configured');
        }

        const vnpParams = {};
        Object.keys(req.query || {}).forEach((key) => {
            if (key.startsWith('vnp_')) vnpParams[key] = req.query[key];
        });

        const providedHash = String(vnpParams.vnp_SecureHash || '');
        delete vnpParams.vnp_SecureHash;
        delete vnpParams.vnp_SecureHashType;

        const computedHash = signVnp(vnpParams, hashSecret);
        const isValidSignature = providedHash && providedHash.toLowerCase() === computedHash.toLowerCase();

        const txnRef = String(req.query?.vnp_TxnRef || '');
        const responseCode = String(req.query?.vnp_ResponseCode || '');
        const transactionStatus = String(req.query?.vnp_TransactionStatus || '');

        const isSuccess = isValidSignature && responseCode === '00' && transactionStatus === '00';
        console.log(`Giao dịch: ${txnRef}, Kết quả: ${isSuccess ? 'Thành công' : 'Thất bại'}, Mã lỗi: ${responseCode}`);

        const payment = await Payment.findOne({ transactionId: txnRef });
        if (payment) {
            const nextStatus = isSuccess ? 'success' : 'failed';
            if (payment.status !== nextStatus) {
                payment.status = nextStatus;
                await payment.save();
            }

            if (isSuccess) {
                await processSubscription(payment, payment.plan, payment.durationDays);
                console.log('Đã kích hoạt gói Premium cho User');
            }
        }

        if (typeof appReturnUrl === 'string' && appReturnUrl.length > 0) {
            let finalUrl;
            try {
                finalUrl = new URL(appReturnUrl);
            } catch (e) {
                // Fallback nếu appReturnUrl không phải URL hợp lệ (ví dụ: expo scheme)
                const separator = appReturnUrl.includes('?') ? '&' : '?';
                const redirectUrl = `${appReturnUrl}${separator}payment=${isSuccess ? 'success' : 'failed'}&txnRef=${txnRef}&code=${responseCode}`;
                return res.redirect(redirectUrl);
            }
            finalUrl.searchParams.set('payment', isSuccess ? 'success' : 'failed');
            finalUrl.searchParams.set('txnRef', txnRef);
            finalUrl.searchParams.set('code', responseCode);
            return res.redirect(finalUrl.toString());
        }

        res.status(200).send(isSuccess ? 'Payment success' : 'Payment failed');
    } catch (error) {
        console.error('Lỗi handleVnpayReturn:', error.message);
        res.status(500).send(String(error.message || 'Payment error'));
    }
};

exports.handleVnpayIpn = async (req, res) => {
    try {
        console.log('--- Nhận thông báo IPN từ VNPay ---');
        const hashSecret = process.env.VNPAY_HASH_SECRET;
        const vnpParams = {};
        Object.keys(req.query || {}).forEach((key) => {
            if (key.startsWith('vnp_')) vnpParams[key] = req.query[key];
        });

        const providedHash = String(vnpParams.vnp_SecureHash || '');
        delete vnpParams.vnp_SecureHash;
        delete vnpParams.vnp_SecureHashType;

        const computedHash = signVnp(vnpParams, hashSecret);

        if (providedHash.toLowerCase() !== computedHash.toLowerCase()) {
            console.error('IPN Checksum thất bại');
            return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
        }

        const txnRef = String(vnpParams.vnp_TxnRef || '');
        const responseCode = String(vnpParams.vnp_ResponseCode || '');
        const amount = Number(vnpParams.vnp_Amount) / 100;

        const payment = await Payment.findOne({ transactionId: txnRef });
        if (!payment) {
            console.error(`IPN: Không tìm thấy giao dịch ${txnRef}`);
            return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
        }

        if (payment.amount !== amount) {
            console.error(`IPN: Sai số tiền (DB: ${payment.amount}, VNPay: ${amount})`);
            return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
        }

        if (payment.status !== 'pending') {
            return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
        }

        const isSuccess = responseCode === '00';
        payment.status = isSuccess ? 'success' : 'failed';
        await payment.save();

        if (isSuccess) {
            await processSubscription(payment, payment.plan, payment.durationDays);
            console.log('IPN: Đã kích hoạt gói Premium');
        }

        console.log(`IPN Xử lý xong giao dịch ${txnRef}`);
        res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    } catch (error) {
        console.error('Lỗi handleVnpayIpn:', error.message);
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};
