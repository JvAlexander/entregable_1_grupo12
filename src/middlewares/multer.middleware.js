import multer from "multer";
import path from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, '../../public');

// Carpeta física según el nombre del campo que envía el cliente
const carpetas = {
    avatar: path.join(publicPath, 'img', 'users'),
    img: path.join(publicPath, 'img', 'pets')
};

const extensionesPermitidas = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const mimetypesPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Un solo diskStorage para usuarios y mascotas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const carpeta = carpetas[file.fieldname];

        if (!carpeta) {
            return cb(new Error('Campo de archivo no permitido'));
        }

        // Crea la carpeta si no existe antes de guardar el archivo
        mkdir(carpeta, { recursive: true })
            .then(() => cb(null, carpeta))
            .catch((error) => cb(error));
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const prefijo = file.fieldname === 'avatar' ? 'avatar' : 'pet';
        const unico = `${Date.now()}-${randomBytes(4).toString('hex')}`;

        // No se usa el nombre original: evita colisiones y caracteres peligrosos
        cb(null, `${prefijo}-${unico}${extension}`);
    }
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!mimetypesPermitidos.includes(file.mimetype) || !extensionesPermitidas.includes(extension)) {
        const error = new Error('Solo se permiten imágenes JPG, PNG, GIF o WEBP');
        error.tipo = 'ARCHIVO_INVALIDO';
        return cb(error);
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB por imagen
    }
});

// Envuelve el middleware de multer para responder los errores en JSON
const manejarErrores = (middleware) => (req, res, next) => {
    middleware(req, res, (error) => {
        if (!error) return next();

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'La imagen supera el tamaño máximo de 5 MB'
                });
            }

            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    error: 'Archivo no permitido: revisa el nombre del campo y la cantidad máxima de archivos'
                });
            }

            return res.status(400).json({ error: 'Error al procesar el archivo' });
        }

        if (error.tipo === 'ARCHIVO_INVALIDO') {
            return res.status(400).json({ error: error.message });
        }

        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
};

// Para usuarios: un solo archivo en el campo "avatar"
export const uploadAvatar = manejarErrores(upload.single('avatar'));

// Para mascotas: hasta 5 archivos en el campo "img"
export const uploadImagenes = manejarErrores(upload.array('img', 5));

// Elimina una imagen a partir de su ruta pública (ej: /img/users/avatar-1.png)
// Solo borra archivos que estén directamente dentro de public/img/users o public/img/pets
export const eliminarImagen = async (rutaPublica) => {
    if (typeof rutaPublica !== 'string' || rutaPublica === '') return;

    const rutaAbsoluta = path.resolve(path.join(publicPath, rutaPublica));
    const carpetaDelArchivo = path.dirname(rutaAbsoluta);

    if (!Object.values(carpetas).includes(carpetaDelArchivo)) return;

    try {
        await unlink(rutaAbsoluta);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('No se pudo eliminar la imagen:', error.message);
        }
    }
};