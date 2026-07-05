const User = require('../model/Users');
const Profile = require('../model/Profile');
const PasswordResetOtp = require('../model/PasswordResetOtp');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const saltRounds = 10;

let cachedTransporter = null;
let cachedGoogleClient = null;

function getJwtSecret() {
    const secret = process.env.JWT_TOKEN_SECRET;
    if (!secret) {
        throw new Error('Missing JWT_TOKEN_SECRET in environment');
    }
    return secret;
}

function getAccessTokenTtl() {
    return String(process.env.ACCESS_TOKEN_TTL || '1h');
}

function getRefreshTokenTtlDays() {
    const v = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
    return Number.isFinite(v) && v > 0 ? v : 30;
}

function hashRefreshToken(refreshToken) {
    const pepper = String(process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_TOKEN_SECRET || 'secret');
    return crypto.createHash('sha256').update(`${String(refreshToken)}:${pepper}`).digest('hex');
}

function signAccessToken(user) {
    const secret = getJwtSecret();
    const payload = {
        userId: user._id,
        role: user.role,
        email: user.email
    };
    return jwt.sign(payload, secret, { expiresIn: getAccessTokenTtl() });
}

function createRefreshTokenRecord() {
    const raw = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashRefreshToken(raw);
    const expiresAt = new Date(Date.now() + getRefreshTokenTtlDays() * 24 * 60 * 60 * 1000);
    return { raw, tokenHash, expiresAt };
}

function pruneRefreshTokens(user) {
    const now = new Date();
    const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
    const alive = tokens.filter((t) => t && t.expiresAt && new Date(t.expiresAt) > now && !t.revokedAt);
    const sorted = alive.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    user.refreshTokens = sorted.slice(0, 10);
}

function isValidEmailFormat(email) {
    const v = String(email || '').trim().toLowerCase();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function hasMxRecords(email) {
    const v = String(email || '').trim().toLowerCase();
    const at = v.lastIndexOf('@');
    if (at < 0) return false;
    const domain = v.slice(at + 1);
    if (!domain) return false;
    
    try {
        const records = await dns.resolveMx(domain);
        return Array.isArray(records) && records.length > 0;
    } catch (error) {
        // In production environments (Render, Vercel), DNS resolution might be restricted.
        // Allow common domains to proceed without MX validation.
        const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        if (commonDomains.includes(domain)) {
            console.warn(`[MX Check] Allowing common domain ${domain} without DNS validation`);
            return true;
        }
        // For other domains, log warning but allow (prevent registration block in serverless envs)
        console.warn(`[MX Check] DNS resolution failed for ${domain}, allowing email anyway:`, error.message);
        return true;
    }
}

function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const userRaw = process.env.SMTP_USER;
    const passRaw = process.env.SMTP_PASS;
    const user = userRaw ? String(userRaw).trim() : '';
    const pass = passRaw ? String(passRaw).replace(/\s+/g, '') : '';

    if (!host || !user || !pass) return null;
    if (cachedTransporter) return cachedTransporter;

    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS: !secure,
        auth: { user, pass }
    });
    return cachedTransporter;
}

function getSmtpErrorHint(error) {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '');
    if (code === 'EAUTH') return 'SMTP đăng nhập thất bại (SMTP_USER/SMTP_PASS). Hãy dùng Gmail App Password và thử lại.';
    if (code === 'ECONNECTION') return 'Không kết nối được SMTP. Kiểm tra mạng hoặc SMTP_HOST/SMTP_PORT.';
    if (code === 'ETIMEDOUT') return 'Kết nối SMTP bị timeout. Thử lại hoặc kiểm tra mạng.';
    if (/username and password not accepted/i.test(message)) return 'SMTP_PASS không đúng hoặc chưa dùng App Password.';
    return 'Không thể gửi email. Vui lòng kiểm tra cấu hình SMTP và thử lại.';
}

async function sendWelcomeEmail(to) {
    const transporter = getTransporter();
    if (!transporter) throw new Error('Email service chưa được cấu hình (SMTP)');

    const appName = process.env.APP_NAME || 'EMOORI';
    const mailFrom = process.env.MAIL_FROM || `${appName} <${process.env.SMTP_USER}>`;
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || '';

    const subject = `Chúc mừng bạn đã đăng ký thành công App ${appName}!`;
    const text =
        `Chúc mừng bạn đã đăng ký thành công App ${appName}.\n` +
        `Cảm ơn bạn đã tham gia. Chúc bạn có những trải nghiệm thật tuyệt vời cùng ${appName}.\n` +
        (supportEmail ? `Nếu cần hỗ trợ, vui lòng liên hệ: ${supportEmail}\n` : '');

    const html =
        `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">` +
        `<h2 style="margin: 0 0 10px;">Chúc mừng bạn!</h2>` +
        `<p style="margin: 0 0 8px;">Bạn đã đăng ký thành công <b>App ${appName}</b>.</p>` +
        `<p style="margin: 0 0 12px;">Cảm ơn bạn đã tham gia. Chúc bạn có những trải nghiệm thật tuyệt vời cùng ${appName}.</p>` +
        (supportEmail ? `<p style="margin: 0;">Hỗ trợ: <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : '') +
        `</div>`;

    await transporter.sendMail({ from: mailFrom, to, subject, text, html });
}

async function sendPasswordOtpEmail(to, otp, expMinutes) {
    const transporter = getTransporter();
    if (!transporter) throw new Error('Email service chưa được cấu hình (SMTP)');

    const appName = process.env.APP_NAME || 'EMOORI';
    const mailFrom = process.env.MAIL_FROM || `${appName} <${process.env.SMTP_USER}>`;
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || '';

    const subject = `Mã OTP đặt lại mật khẩu ${appName}`;
    const text =
        `Bạn vừa yêu cầu đặt lại mật khẩu cho ${appName}.\n` +
        `Mã OTP của bạn là: ${otp}\n` +
        `Mã sẽ hết hạn sau ${expMinutes} phút.\n` +
        (supportEmail ? `Nếu bạn không yêu cầu, vui lòng liên hệ: ${supportEmail}\n` : '');

    const html =
        `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">` +
        `<h2 style="margin: 0 0 10px;">Đặt lại mật khẩu</h2>` +
        `<p style="margin: 0 0 8px;">Bạn vừa yêu cầu đặt lại mật khẩu cho <b>${appName}</b>.</p>` +
        `<p style="margin: 0 0 8px;">Mã OTP của bạn:</p>` +
        `<div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; padding: 10px 14px; background:#F3F4F6; display:inline-block; border-radius: 10px;">${otp}</div>` +
        `<p style="margin: 12px 0 0;">Mã sẽ hết hạn sau <b>${expMinutes} phút</b>.</p>` +
        (supportEmail ? `<p style="margin: 12px 0 0;">Hỗ trợ: <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : '') +
        `</div>`;

    await transporter.sendMail({ from: mailFrom, to, subject, text, html });
}

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password -refreshTokens').lean();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUserPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        if (!['free', 'premium'].includes(plan)) {
            return res.status(400).json({ message: 'Invalid plan' });
        }

        const next = String(plan).toLowerCase();
        const updated = await User.findByIdAndUpdate(
            id,
            { plan: next, premiumPlan: next, isPremium: next !== 'free' },
            { new: true }
        ).lean();
        if (!updated) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(updated);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        // console.log(">>> check req.body", req.body);
        const { email, password, role, plan, phone } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        }

        if (!isValidEmailFormat(email)) {
            return res.status(400).json({ error: 'Email không đúng định dạng' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        
        // Validate email domain (non-blocking in serverless environments)
        const mxValid = await hasMxRecords(normalizedEmail);
        if (!mxValid) {
            return res.status(400).json({ error: 'Email domain không hợp lệ' });
        }
        const isAdminEmail = normalizedEmail.includes('admin');
        //hash user password
        const hashPassword = await bcrypt.hash(password, saltRounds);
        //Tạo mới user
        const user = new User({
            plan: plan || (isAdminEmail ? 'premium' : 'free'),
            email: normalizedEmail,
            password: hashPassword,
            role: role || (isAdminEmail ? 'admin' : 'user')
        });
        await user.save();

        // Tự động tạo profile trống cho user mới
        const newProfile = new Profile({
            userId: user._id,
            phone: phone ? String(phone).trim() : undefined,
            bio: 'Xin chào, tôi là người dùng mới!'
        });
        await newProfile.save();

        sendWelcomeEmail(normalizedEmail).catch((e) => {
            console.error('Send welcome email failed:', e?.message || e);
        });

        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

exports.requestPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Vui lòng nhập email' });
        }

        if (!isValidEmailFormat(email)) {
            return res.status(400).json({ error: 'Email không đúng định dạng' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        const transporter = getTransporter();
        if (!transporter) {
            return res.status(500).json({
                error: 'Chức năng gửi email chưa sẵn sàng. Vui lòng cấu hình SMTP_USER/SMTP_PASS (App Password) trong .env'
            });
        }

        // Validate email domain (non-blocking in serverless environments)
        const mxValid = await hasMxRecords(normalizedEmail);
        if (!mxValid) {
            return res.status(400).json({ error: 'Email domain không hợp lệ' });
        }

        const user = await User.findOne({ email: normalizedEmail }).lean();
        if (!user) {
            return res.status(404).json({ error: 'Email chưa được đăng ký' });
        }

        const otpExpMinutes = Number(process.env.OTP_EXP_MINUTES || process.env.RESET_TOKEN_EXP_MINUTES || 10);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const salt = String(process.env.JWT_TOKEN_SECRET || 'secret');
        const otpHash = crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
        const expiresAt = new Date(Date.now() + otpExpMinutes * 60 * 1000);

        await PasswordResetOtp.deleteMany({ userId: user._id });
        await PasswordResetOtp.create({
            userId: user._id,
            email: normalizedEmail,
            otpHash,
            expiresAt
        });

        try {
            await sendPasswordOtpEmail(normalizedEmail, otp, otpExpMinutes);
        } catch (e) {
            await PasswordResetOtp.deleteMany({ userId: user._id });
            console.error('Send OTP email failed:', e?.message || e);
            return res.status(500).json({
                error: 'Không thể gửi OTP qua email. Vui lòng kiểm tra cấu hình SMTP (Gmail App Password) và thử lại',
                hint: getSmtpErrorHint(e)
            });
        }

        return res.status(200).json({ message: 'Mã OTP đã được gửi về email của bạn' });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Không thể gửi OTP' });
    }
};

exports.verifyPasswordOtp = async (req, res) => {
    try {
        const { email, otp } = req.body || {};
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const rawOtp = String(otp || '').trim();

        if (!normalizedEmail) return res.status(400).json({ error: 'Vui lòng nhập email' });
        if (!isValidEmailFormat(normalizedEmail)) return res.status(400).json({ error: 'Email không đúng định dạng' });
        if (!/^\d{6}$/.test(rawOtp)) return res.status(400).json({ error: 'OTP phải gồm 6 chữ số' });

        const user = await User.findOne({ email: normalizedEmail }).lean();
        if (!user) return res.status(404).json({ error: 'Email chưa được đăng ký' });

        const record = await PasswordResetOtp.findOne({
            userId: user._id,
            usedAt: null,
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (!record) {
            return res.status(400).json({ error: 'OTP không hợp lệ hoặc đã hết hạn' });
        }

        const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
        if (record.attempts >= maxAttempts) {
            return res.status(429).json({ error: 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu OTP mới' });
        }

        const salt = String(process.env.JWT_TOKEN_SECRET || 'secret');
        const inputHash = crypto.createHash('sha256').update(`${rawOtp}:${salt}`).digest('hex');
        if (inputHash !== record.otpHash) {
            record.attempts += 1;
            await record.save();
            return res.status(400).json({ error: 'OTP không đúng' });
        }

        record.usedAt = new Date();
        await record.save();

        const secret = process.env.JWT_TOKEN_SECRET;
        if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

        const expMinutes = Number(process.env.RESET_TOKEN_EXP_MINUTES || 15);
        const resetToken = jwt.sign({ userId: user._id, purpose: 'pwd_reset' }, secret, { expiresIn: expMinutes * 60 });
        return res.status(200).json({ resetToken });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Không thể xác thực OTP' });
    }
};

exports.resetPasswordWithToken = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body || {};
        const token = String(resetToken || '').trim();
        const pwd = String(newPassword || '');

        if (!token) return res.status(400).json({ error: 'Thiếu resetToken' });
        if (!pwd || pwd.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });

        const secret = process.env.JWT_TOKEN_SECRET;
        if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

        let payload;
        try {
            payload = jwt.verify(token, secret);
        } catch {
            return res.status(401).json({ error: 'Reset token không hợp lệ hoặc đã hết hạn' });
        }

        if (!payload || payload.purpose !== 'pwd_reset' || !payload.userId) {
            return res.status(401).json({ error: 'Reset token không hợp lệ' });
        }

        const hashPassword = await bcrypt.hash(pwd, saltRounds);
        const updated = await User.findByIdAndUpdate(payload.userId, { password: hashPassword }, { new: true }).lean();
        if (!updated) return res.status(404).json({ error: 'User not found' });

        await PasswordResetOtp.deleteMany({ userId: payload.userId });

        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Không thể đổi mật khẩu' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { currentPassword, newPassword } = req.body || {};

        if (!userId) {
            return res.status(401).json({ error: 'Bạn chưa đăng nhập' });
        }

        const current = String(currentPassword || '');
        const next = String(newPassword || '');

        if (!current || !next) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới' });
        }

        if (next.length < 8) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
        }

        if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
            return res.status(400).json({ error: 'Mật khẩu mới phải gồm cả chữ và số' });
        }

        if (current === next) {
            return res.status(400).json({ error: 'Mật khẩu mới không được trùng mật khẩu hiện tại' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const passwordMatch = await bcrypt.compare(current, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
        }

        user.password = await bcrypt.hash(next, saltRounds);
        user.refreshTokens = [];
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Không thể đổi mật khẩu' });
    }
};
//Login with email and password
exports.handleLogin = async (req, res) => {
    try {
        // validate input
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const isAdminEmail = normalizedEmail.includes('admin');
        // check email exist
        let user = await User.findOne({ email: normalizedEmail });//tìm trong db 
        if (!user && isAdminEmail) {
            const secret = process.env.JWT_TOKEN_SECRET;
            if (!secret) {
                console.error('Missing JWT_TOKEN_SECRET in environment');
                return res.status(500).json({ error: 'Server misconfiguration' });
            }
            const hashPassword = await bcrypt.hash(password, saltRounds);
            user = new User({
                email: normalizedEmail,
                password: hashPassword,
                role: 'admin',
                plan: 'premium'
            });
            await user.save();
        }

        if (!user) {
            return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
        }

        // Bcrypt match (requires hash to exist)
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
        }
        const token = signAccessToken(user);
        const { raw: refreshToken, tokenHash, expiresAt } = createRefreshTokenRecord();
        user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
        user.refreshTokens.push({ tokenHash, expiresAt });
        pruneRefreshTokens(user);
        await user.save();

        // return token
        res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            userId: user._id,
            email: user.email,
            role: user.role,
            plan: user.plan
        });
    } catch (error) {
        // Log debug
        console.error('Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

function getGoogleWebClientId() {
    const clientId = String(process.env.GOOGLE_WEB_CLIENT_ID || '').trim();
    if (!clientId) {
        const error = new Error('Thiếu GOOGLE_WEB_CLIENT_ID trong Backend/.env');
        error.statusCode = 500;
        throw error;
    }
    return clientId;
}

function getGoogleOAuthClient() {
    if (!cachedGoogleClient) {
        cachedGoogleClient = new OAuth2Client();
    }
    return cachedGoogleClient;
}

exports.handleGoogleLogin = async (req, res) => {
    try {
        const { idToken } = req.body || {};
        if (!idToken) {
            return res.status(400).json({ error: 'Thiếu idToken' });
        }

        const googleWebClientId = getGoogleWebClientId();
        const client = getGoogleOAuthClient();
        const ticket = await client.verifyIdToken({
            idToken: String(idToken),
            audience: googleWebClientId
        });
        const payload = ticket.getPayload() || {};
        const email = String(payload.email || '').trim().toLowerCase();
        const emailVerified = payload.email_verified === true;
        const name = String(payload.name || payload.given_name || '').trim();
        const aud = String(payload.aud || '').trim();

        if (!email) {
            return res.status(400).json({ error: 'Không lấy được email từ Google' });
        }
        if (!emailVerified) {
            return res.status(401).json({ error: 'Email Google chưa được xác minh' });
        }
        if (aud !== googleWebClientId) {
            return res.status(401).json({ error: 'Google Web Client ID không khớp' });
        }

        const isAdminEmail = email.includes('admin');
        let user = await User.findOne({ email });
        if (!user) {
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const hashPassword = await bcrypt.hash(randomPassword, saltRounds);
            user = new User({
                plan: isAdminEmail ? 'premium' : 'free',
                email,
                password: hashPassword,
                role: isAdminEmail ? 'admin' : 'user'
            });
            await user.save();
        }

        const existingProfile = await Profile.findOne({ userId: user._id });
        if (!existingProfile) {
            const newProfile = new Profile({
                userId: user._id,
                fullName: name || undefined,
                bio: 'Xin chào, tôi là người dùng mới!'
            });
            await newProfile.save();
        }

        const token = signAccessToken(user);
        const { raw: refreshToken, tokenHash, expiresAt } = createRefreshTokenRecord();
        user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
        user.refreshTokens.push({ tokenHash, expiresAt });
        pruneRefreshTokens(user);
        await user.save();

        return res.status(200).json({
            message: 'Login successful',
            token,
            refreshToken,
            userId: user._id,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error(
            'Google auth error:',
            JSON.stringify(
                {
                    message: String(error?.message || ''),
                    code: error?.code || null,
                    statusCode: error?.statusCode || null
                },
                null,
                2
            )
        );
        const status = Number(error?.statusCode || 500);
        return res.status(status).json({ error: error?.message || 'Đăng nhập Google thất bại' });
    }
};

exports.handleRefresh = async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        const raw = String(refreshToken || '').trim();
        if (!raw) return res.status(400).json({ error: 'Thiếu refreshToken' });

        const tokenHash = hashRefreshToken(raw);
        const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
        if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

        const record = (user.refreshTokens || []).find((t) => String(t.tokenHash) === tokenHash);
        if (!record) return res.status(401).json({ error: 'Invalid or expired token' });
        if (record.revokedAt) return res.status(401).json({ error: 'Invalid or expired token' });
        if (!record.expiresAt || new Date(record.expiresAt) <= new Date()) return res.status(401).json({ error: 'Invalid or expired token' });

        const token = signAccessToken(user);
        const next = createRefreshTokenRecord();

        record.revokedAt = new Date();
        record.replacedByTokenHash = next.tokenHash;
        user.refreshTokens.push({ tokenHash: next.tokenHash, expiresAt: next.expiresAt });
        pruneRefreshTokens(user);
        await user.save();

        return res.status(200).json({
            message: 'Refresh successful',
            token,
            refreshToken: next.raw,
            userId: user._id,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.handleLogout = async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        const raw = String(refreshToken || '').trim();
        if (!raw) return res.status(200).json({ message: 'Logged out' });

        const tokenHash = hashRefreshToken(raw);
        const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });
        if (!user) return res.status(200).json({ message: 'Logged out' });

        const record = (user.refreshTokens || []).find((t) => String(t.tokenHash) === tokenHash);
        if (record && !record.revokedAt) {
            record.revokedAt = new Date();
            await user.save();
        }

        return res.status(200).json({ message: 'Logged out' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

