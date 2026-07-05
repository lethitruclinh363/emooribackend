const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');

function getOpenAiKey() {
  const k = String(process.env.OPENAI_API_KEY || '').trim();
  if (!k) {
    const err = new Error('AI provider chưa được cấu hình (OPENAI_API_KEY)');
    err.statusCode = 503;
    throw err;
  }
  return k;
}

function getImageModel() {
  return String(process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1').trim() || 'gpt-image-1';
}

function getImageSize() {
  return String(process.env.OPENAI_IMAGE_SIZE || '1024x1024').trim() || '1024x1024';
}

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function randomName(ext) {
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

async function editImage({ inputFilePath, prompt, outputDir }) {
  const apiKey = getOpenAiKey();
  const model = getImageModel();
  const size = getImageSize();

  ensureDir(outputDir);

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', String(prompt || '').trim());
  form.append('size', size);
  form.append('n', '1');
  form.append('image', fs.createReadStream(inputFilePath));

  console.log(
    '[ai.image] Request:',
    JSON.stringify(
      {
        keyLoaded: String(process.env.OPENAI_API_KEY || '').trim().length > 0,
        model,
        size,
        promptLength: String(prompt || '').trim().length
      },
      null,
      2
    )
  );

  let res;
  try {
    res = await axios.post('https://api.openai.com/v1/images/edits', form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      timeout: 120000
    });
  } catch (error) {
    const status = Number(error?.response?.status || error?.status || error?.statusCode || 500);
    const providerData = error?.response?.data?.error || error?.response?.data || {};
    const code = String(error?.code || providerData?.code || providerData?.error?.code || '').trim();
    const type = String(error?.name || providerData?.type || providerData?.error?.type || '').trim();
    const message = String(providerData?.message || error?.message || 'OpenAI image failed').trim();

    console.error(
      '[ai.image] OpenAI error:',
      JSON.stringify(
        {
          status,
          code: code || null,
          type: type || null,
          message,
          model,
          size
        },
        null,
        2
      )
    );

    const nextError = new Error(`OpenAI image failed: ${message}`);
    nextError.statusCode = Number.isFinite(status) && status > 0 ? status : 500;
    nextError.code = code || undefined;
    nextError.providerStatus = nextError.statusCode;
    nextError.providerType = type || undefined;
    throw nextError;
  }

  const item = res?.data?.data?.[0];
  const b64 = item?.b64_json ? String(item.b64_json) : '';
  const url = item?.url ? String(item.url) : '';

  if (b64) {
    const buf = Buffer.from(b64, 'base64');
    const fileName = randomName('.png');
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, buf);
    return { localFilePath: filePath, providerUrl: '' };
  }

  if (url) {
    const fileName = randomName('.png');
    const filePath = path.join(outputDir, fileName);
    const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(filePath, Buffer.from(img.data));
    return { localFilePath: filePath, providerUrl: url };
  }

  const err = new Error('AI Image API trả về dữ liệu không hợp lệ');
  err.statusCode = 502;
  throw err;
}

module.exports = { editImage, getImageModel, getImageSize };
