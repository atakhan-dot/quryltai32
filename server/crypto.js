import crypto from 'crypto';

// Секретный мастер-ключ сервера для шифрования хранилища паролей
const SECRET = process.env.ENCRYPTION_KEY || 'kurultai-super-secret-master-key-2026-kz';
const KEY = crypto.createHash('sha256').update(SECRET).digest();

/**
 * Шифрует строку пароля с использованием AES-256-GCM
 * @param {string} text - Исходный пароль в открытом виде
 * @returns {string} - Зашифрованная строка в формате iv:tag:ciphertext
 */
export function encryptPassword(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Расшифровывает строку обратно в открытый текст
 * @param {string} encryptedPayload - Строка формата iv:tag:ciphertext
 * @returns {string} - Расшифрованный пароль
 */
export function decryptPassword(encryptedPayload) {
  if (!encryptedPayload) return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Некорректный формат зашифрованных данных');
    }
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Ошибка расшифровки пароля:', error.message);
    throw new Error('Не удалось расшифровать данные');
  }
}
