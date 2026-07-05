# EMOORI Render Deploy Checklist

## 1. Muc tieu

Backend public can phuc vu cho ca Admin va Mobile tai:

`https://emoori-api.onrender.com`

Base API:

`https://emoori-api.onrender.com/api`

## 2. Route can phai hoat dong sau deploy

- `GET /api`
- `GET /api/health`
- `GET /api/music/tracks`
- `POST /api/login`
- `GET /api/admin/music/tracks`

## 3. File backend bat buoc phai len Render

- `Backend/server.js`
- `Backend/package.json`
- `Backend/src/routes/MusicRoutes.js`
- `Backend/src/controllers/MusicTrackControllers.js`
- `Backend/src/controllers/admin/MusicTrackController.js`
- `Backend/src/model/MusicTrack.js`
- `Backend/src/routes/adminRoutes.js`
- `Backend/src/services/storageService.js`

## 4. Env can co tren Render

- `PUBLIC_BASE_URL=https://emoori-api.onrender.com`
- `MONGODB_URI=...`
- `JWT_TOKEN_SECRET=...`
- `OPENAI_API_KEY=...`
- `SMTP_HOST=...`
- `SMTP_PORT=...`
- `SMTP_SECURE=...`
- `SMTP_USER=...`
- `SMTP_PASS=...`
- `MAIL_FROM=...`
- `RESET_TOKEN_EXP_MINUTES=...`
- `OTP_EXP_MINUTES=...`
- `OTP_MAX_ATTEMPTS=...`
- `VNPAY_TMN_CODE=...`
- `VNPAY_HASH_SECRET=...`
- `VNPAY_URL=...`

Neu muon upload media production on dinh:

- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `CLOUDINARY_FOLDER=emoori`

## 5. Cac buoc deploy

1. Commit va push cac file backend lien quan.
2. Neu dung Render Blueprint, import `render.yaml` o root repo.
3. Neu service da ton tai, vao Render dashboard va trigger redeploy.
4. Xac nhan `PUBLIC_BASE_URL` dung domain Render.
5. Cho deploy xong roi test lai cac URL verify.

## 6. Cach verify bang trinh duyet

Mo lan luot:

- `https://emoori-api.onrender.com/api`
- `https://emoori-api.onrender.com/api/health`
- `https://emoori-api.onrender.com/api/music/tracks`

Ket qua dung cho `/api/music/tracks` la JSON:

```json
{
  "success": true,
  "tracks": []
}
```

Neu van thay:

```text
Cannot GET /api/music/tracks
```

thi backend tren Render chua deploy ban moi co route music.

## 7. Sau khi route music hoat dong

1. Mo Admin va dang nhap vao dung backend Render.
2. Vao `/admin/music`.
3. Tao hoac sua 1 bai nhac.
4. Upload `audioFile` that hoac nhap `audioUrl` public HTTPS hop le.
5. Bat `Active`.
6. Tren mobile, clear cache dev:

```js
globalThis.clearMusicCacheForDev?.()
```

7. Mo `Healing Music`, de chip o `Tat ca`, keo xuong refresh.

## 8. URL cuoi cung can thong nhat

- Admin API base: `https://emoori-api.onrender.com/api`
- Mobile API base: `https://emoori-api.onrender.com/api`
- Music list: `https://emoori-api.onrender.com/api/music/tracks`
- Login: `https://emoori-api.onrender.com/api/login`
