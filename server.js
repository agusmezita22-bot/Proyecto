const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

let scores = [];

// Ruta raíz de prueba
app.get('/', (req, res) => {
    res.send('Servidor activo');
});

// Ruta de leaderboard
app.get('/leaderboard', (req, res) => {
    const topScores = scores.map(s => ({
        name: s.name,
        score: s.score
    }));
    return res.status(200).json(topScores);
});

// Ruta para guardar puntaje
app.post('/score', (req, res) => {
    const { name, score } = req.body;

    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    const existingUserIndex = scores.findIndex(
        s => s.name.toLowerCase() === name.toLowerCase()
    );

    if (existingUserIndex !== -1) {
        if (score > scores[existingUserIndex].score) {
            scores[existingUserIndex].score = score;
        }
    } else {
        scores.push({ name, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return res.status(200).json({ success: true, scores });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
