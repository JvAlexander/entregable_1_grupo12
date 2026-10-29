import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import usersRouter from "./routes/users.router.js";
import petsRouter from "./routes/pets.router.js";

// En módulos ES6 no existe __dirname, se construye con import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Publica la carpeta public: /img/users/archivo.png -> public/img/users/archivo.png
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/users', usersRouter);
app.use('/api/pets', petsRouter);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Errores generales (por ejemplo, un JSON mal escrito en el body)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'El JSON enviado no es válido' });
    }

    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});