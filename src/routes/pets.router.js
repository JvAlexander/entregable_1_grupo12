import { Router } from "express";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uploadImagenes, eliminarImagen } from "../middlewares/multer.middleware.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const petsPath = path.join(__dirname, '../data/pets.json');

const MAX_IMAGENES = 5;

// Cola: ejecuta una tarea a la vez para que dos solicitudes no pisen el archivo
let cola = Promise.resolve();

const enCola = (tarea) => {
    const resultado = cola.then(tarea);
    cola = resultado.catch(() => {});
    return resultado;
};

// Lee pets.json. Si no existe o está vacío devuelve []. Si está dañado lanza error (no lo sobrescribe)
const leerPets = async () => {
    try {
        const contenido = await readFile(petsPath, 'utf-8');

        if (contenido.trim() === '') return [];

        const pets = JSON.parse(contenido);

        if (!Array.isArray(pets)) {
            throw new Error('pets.json no contiene un arreglo');
        }

        return pets;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const guardarPets = async (pets) => {
    await mkdir(path.dirname(petsPath), { recursive: true });
    await writeFile(petsPath, JSON.stringify(pets, null, 2));
};

const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';

// Convierte el id de la URL a número entero positivo (o null si no es válido)
const convertirId = (valor) => {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Valida los campos de la mascota.
// Si obligatorios es true, todos deben venir (POST). Si es false, solo se validan los enviados (PUT)
const validarCampos = (body, obligatorios) => {
    const { especie, color, edad, sexo } = body;
    const datos = {};

    if (obligatorios || especie !== undefined) {
        if (!textoValido(especie)) {
            return { error: 'La especie es obligatoria y debe ser texto' };
        }
        datos.especie = especie.trim();
    }

    if (obligatorios || color !== undefined) {
        if (!textoValido(color)) {
            return { error: 'El color es obligatorio y debe ser texto' };
        }
        datos.color = color.trim();
    }

    if (obligatorios || edad !== undefined) {
        const edadNumero = Number(edad);
        const tipoValido = typeof edad === 'string' || typeof edad === 'number';

        if (!tipoValido || String(edad).trim() === '' || !Number.isFinite(edadNumero) || edadNumero < 0) {
            return { error: 'La edad debe ser un número mayor o igual a 0' };
        }
        datos.edad = edadNumero;
    }

    if (obligatorios || sexo !== undefined) {
        const sexoTexto = typeof sexo === 'string' ? sexo.trim().toLowerCase() : '';

        if (sexoTexto !== 'macho' && sexoTexto !== 'hembra') {
            return { error: 'El sexo debe ser "macho" o "hembra"' };
        }
        datos.sexo = sexoTexto;
    }

    return { datos };
};

// Convierte los archivos subidos por Multer en rutas públicas
const rutasPublicas = (files) => (files || []).map(file => `/img/pets/${file.filename}`);

router.get('/', async (req, res) => {
    try {
        const pets = await enCola(leerPets);

        res.json(pets);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudieron leer las mascotas' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = convertirId(req.params.id);

        if (id === null) {
            return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
        }

        const pets = await enCola(leerPets);

        const pet = pets.find(p => p.id === id);

        if (!pet) {
            return res.status(404).json({ error: 'Pet not found' });
        }

        res.json(pet);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se pudo leer la mascota' });
    }
});

router.post('/', uploadImagenes, async (req, res) => {
    await enCola(async () => {
        const img = rutasPublicas(req.files);
        let guardado = false;

        try {
            const body = req.body || {};

            const { datos, error } = validarCampos(body, true);

            if (error) {
                return res.status(400).json({ error });
            }

            const pets = await leerPets();

            let newId;

            if (body.id !== undefined && body.id !== '') {
                newId = convertirId(body.id);

                if (newId === null) {
                    return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
                }

                if (pets.some(p => p.id === newId)) {
                    return res.status(400).json({ error: 'Ya existe una mascota con ese id' });
                }
            } else {
                newId = pets.length > 0 ? Math.max(...pets.map(p => p.id)) + 1 : 1;
            }

            const newPet = {
                id: newId,
                especie: datos.especie,
                color: datos.color,
                edad: datos.edad,
                sexo: datos.sexo,
                img
            };

            pets.push(newPet);

            await guardarPets(pets);
            guardado = true;

            res.status(201).json(newPet);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo crear la mascota' });
        } finally {
            // Si no se guardó la mascota, se borran las imágenes que Multer ya había subido
            if (!guardado) {
                for (const ruta of img) await eliminarImagen(ruta);
            }
        }
    });
});

/*
  Política de imágenes en PUT:
  - Sin archivos en "img": se conservan las imágenes actuales.
  - Con archivos y modoImg = "agregar" (por defecto): se suman a las existentes (máximo 5 en total).
  - Con archivos y modoImg = "reemplazar": las anteriores se eliminan y quedan solo las nuevas.
*/
router.put('/:id', uploadImagenes, async (req, res) => {
    await enCola(async () => {
        const nuevas = rutasPublicas(req.files);
        let guardado = false;

        try {
            const id = convertirId(req.params.id);

            if (id === null) {
                return res.status(400).json({ error: 'El id debe ser un número entero positivo' });
            }

            const pets = await leerPets();

            const index = pets.findIndex(p => p.id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'Pet not found' });
            }

            const body = req.body || {};

            const { datos, error } = validarCampos(body, false);

            if (error) {
                return res.status(400).json({ error });
            }

            const modo = body.modoImg === undefined ? 'agregar' : String(body.modoImg).trim().toLowerCase();

            if (modo !== 'agregar' && modo !== 'reemplazar') {
                return res.status(400).json({ error: 'modoImg debe ser "agregar" o "reemplazar"' });
            }

            if (modo === 'reemplazar' && nuevas.length === 0) {
                return res.status(400).json({ error: 'Para reemplazar debes enviar al menos una imagen en el campo img' });
            }

            if (Object.keys(datos).length === 0 && nuevas.length === 0) {
                return res.status(400).json({ error: 'No se envió ningún dato para actualizar' });
            }

            const anterior = pets[index];
            const imagenesAnteriores = anterior.img || [];

            let imagenesFinales = imagenesAnteriores;

            if (nuevas.length > 0) {
                if (modo === 'reemplazar') {
                    imagenesFinales = nuevas;
                } else {
                    if (imagenesAnteriores.length + nuevas.length > MAX_IMAGENES) {
                        return res.status(400).json({
                            error: `Una mascota puede tener máximo ${MAX_IMAGENES} imágenes (actualmente tiene ${imagenesAnteriores.length})`
                        });
                    }
                    imagenesFinales = [...imagenesAnteriores, ...nuevas];
                }
            }

            // Se conservan los campos que no fueron enviados
            const actualizada = { ...anterior, ...datos, img: imagenesFinales };

            pets[index] = actualizada;

            await guardarPets(pets);
            guardado = true;

            if (modo === 'reemplazar') {
                for (const ruta of imagenesAnteriores) await eliminarImagen(ruta);
            }

            res.status(200).json(actualizada);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo actualizar la mascota' });
        } finally {
            if (!guardado) {
                for (const ruta of nuevas) await eliminarImagen(ruta);
            }
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

            const pets = await leerPets();

            const index = pets.findIndex(p => p.id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'Pet not found' });
            }

            const [eliminada] = pets.splice(index, 1);

            await guardarPets(pets);

            for (const ruta of eliminada.img || []) await eliminarImagen(ruta);

            res.status(200).json({
                mensaje: 'Mascota eliminada correctamente',
                pet: eliminada
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'No se pudo eliminar la mascota' });
        }
    });
});

export default router;