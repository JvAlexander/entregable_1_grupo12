import { Router } from "express";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../utils/crypto.js";
import { uploadAvatar, eliminarImagen } from "../middlewares/multer.middleware.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersPath = path.join(__dirname, '../data/users.json');

// Cola: ejecuta una tarea a la vez para que dos solicitudes no pisen el archivo
let cola = Promise.resolve();

const enCola = (tarea) => {
    const resultado = cola.then(tarea);
    cola = resultado.catch(() => {});
    return resultado;
};

// Lee users.json. Si no existe o está vacío devuelve []. Si está dañado lanza error (no lo sobrescribe)
const leerUsers = async () => {
    try {
        const contenido = await readFile(usersPath, 'utf-8');

        if (contenido.trim() === '') return [];

        const users = JSON.parse(contenido);

        if (!Array.isArray(users)) {
            throw new Error('users.json no contiene un arreglo');
        }

        return users;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const guardarUsers = async (users) => {
    await mkdir(path.dirname(usersPath), { recursive: true });
    await writeFile(usersPath, JSON.stringify(users, null, 2));
};

// Quita la contraseña antes de enviar el usuario al cliente
const sinPassword = (user) => {
    const { password, ...resto } = user;
    return resto;
};

const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';

// Convierte el id de la URL a número entero positivo (o null si no es válido)
const convertirId = (valor) => {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
};

router.get('/', async (req, res) => {
    try {
        const users = await enCola(leerUsers);

        res.json(users.map(sinPassword));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudieron leer los usuarios' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = convertirId(req.params.id);

        if (id === null) {
            return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
        }

        const users = await enCola(leerUsers);

        const user = users.find(u => u.id === id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(sinPassword(user));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudo leer el usuario' });
    }
});

router.post('/', uploadAvatar, async (req, res) => {
    await enCola(async () => {
        const avatar = req.file ? `/img/users/${req.file.filename}` : null;
        let guardado = false;

        try {
            const { id, firstname, lastname, username, password } = req.body || {};

            if (!textoValido(firstname) || !textoValido(lastname) || !textoValido(username) || !textoValido(password)) {
                return res.status(400).json({
                    error: 'Faltan campos obligatorios: firstname, lastname, username y password'
                });
            }

            const users = await leerUsers();

            let newId;

            if (id !== undefined && id !== '') {
                newId = convertirId(id);

                if (newId === null) {
                    return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
                }

                if (users.some(u => u.id === newId)) {
                    return res.status(400).json({ error: 'Ya existe un usuario con ese id' });
                }
            } else {
                newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            }

            const newUser = {
                id: newId,
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                username: username.trim(),
                password: await hashPassword(password),
                avatar
            };

            users.push(newUser);

            await guardarUsers(users);
            guardado = true;

            res.status(201).json(sinPassword(newUser));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo crear el usuario' });
        } finally {
            // Si no se guardó el usuario, se borra la imagen que Multer ya había subido
            if (!guardado && avatar) await eliminarImagen(avatar);
        }
    });
});

router.put('/:id', uploadAvatar, async (req, res) => {
    await enCola(async () => {
        const nuevoAvatar = req.file ? `/img/users/${req.file.filename}` : null;
        let guardado = false;

        try {
            const id = convertirId(req.params.id);

            if (id === null) {
                return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
            }

            const users = await leerUsers();

            const index = users.findIndex(u => u.id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            const { firstname, lastname, username, password } = req.body || {};
            const enviados = { firstname, lastname, username, password };

            // Los campos enviados no pueden estar vacíos
            for (const campo in enviados) {
                if (enviados[campo] !== undefined && !textoValido(enviados[campo])) {
                    return res.status(400).json({ error: `El campo ${campo} no es válido` });
                }
            }

            const sinCambios = Object.values(enviados).every(valor => valor === undefined);

            if (sinCambios && !nuevoAvatar) {
                return res.status(400).json({ error: 'No se envió ningún dato para actualizar' });
            }

            const anterior = users[index];

            // Se copia el usuario completo y solo se cambian los campos enviados
            const actualizado = { ...anterior };

            if (firstname !== undefined) actualizado.firstname = firstname.trim();
            if (lastname !== undefined) actualizado.lastname = lastname.trim();
            if (username !== undefined) actualizado.username = username.trim();
            if (password !== undefined) actualizado.password = await hashPassword(password);
            if (nuevoAvatar) actualizado.avatar = nuevoAvatar;

            users[index] = actualizado;

            await guardarUsers(users);
            guardado = true;

            // Ya guardado el JSON, se elimina el avatar anterior
            if (nuevoAvatar && anterior.avatar) await eliminarImagen(anterior.avatar);

            res.status(200).json(sinPassword(actualizado));
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo actualizar el usuario' });
        } finally {
            if (!guardado && nuevoAvatar) await eliminarImagen(nuevoAvatar);
        }
    });
});

router.delete('/:id', async (req, res) => {
    await enCola(async () => {
        try {
            const id = convertirId(req.params.id);

            if (id === null) {
                return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
            }

            const users = await leerUsers();

            const index = users.findIndex(u => u.id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            const [eliminado] = users.splice(index, 1);

            await guardarUsers(users);

            await eliminarImagen(eliminado.avatar);

            res.status(200).json({
                mensaje: 'Usuario eliminado correctamente',
                user: sinPassword(eliminado)
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo eliminar el usuario' });
        }
    });
});

export default router;