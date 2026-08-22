const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir solicitudes desde GitHub Pages
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Base de datos temporal en memoria (Sustituir por MongoDB / PostgreSQL si se requiere persistencia permanente)
let scores = [];

// Endpoint para guardar o actualizar un puntaje (POST /score)
app.post('/score', (req, res) => {
    const { name, score } = req.body;

    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Nombre y puntaje válido son requeridos.' });
    }

    const cleanName = name.trim();
    if (cleanName.length === 0) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
    }

    // Buscar si el jugador ya existe para actualizar su mejor récord
    const existingPlayerIndex = scores.findIndex(p => p.name.toLowerCase() === cleanName.toLowerCase());

    if (existingPlayerIndex !== -1) {
        if (score > scores[existingPlayerIndex].score) {
            scores[existingPlayerIndex].score = score;
            scores[existingPlayerIndex].date = new Date();
        }
    } else {
        scores.push({
            name: cleanName,
            score: score,
            date: new Date()
        });
    }

    // Ordenar puntajes de mayor a menor
    scores.sort((a, b) => b.score - a.score);

    return res.status(200).json({ success: true, message: 'Puntaje registrado con éxito.' });
});

// Endpoint para obtener la tabla de posiciones (GET /leaderboard)
app.get('/leaderboard', (req, res) => {
    // Retorna la lista de récords ordenada
    const topScores = scores.map(s => ({
        name: s.name,
        score: s.score
    }));

    return res.status(200).json(topScores);
});

// Inicio del servidor
app.listen(PORT, () => {
    console.log(`Servidor de Pixel-Hop ejecutándose en el puerto ${PORT}`);
});
