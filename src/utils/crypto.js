import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt trabaja con callbacks; promisify lo convierte para usar async/await
const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;

// Genera un salt aleatorio y devuelve "salt:hash" (ambos en hexadecimal)
export const hashPassword = async (password) => {
    const salt = randomBytes(16).toString('hex');
    const hash = await scryptAsync(password, salt, KEY_LENGTH);

    return `${salt}:${hash.toString('hex')}`;
};

// Compara una contraseña con el valor guardado "salt:hash"
export const verifyPassword = async (password, stored) => {
    if (typeof stored !== 'string') return false;

    const [salt, hash] = stored.split(':');

    if (!salt || !hash) return false;

    const hashGuardado = Buffer.from(hash, 'hex');
    const hashNuevo = await scryptAsync(password, salt, hashGuardado.length);

    // timingSafeEqual evita ataques por tiempo de respuesta
    return timingSafeEqual(hashGuardado, hashNuevo);
};