const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite peticiones desde GitHub Pages y otros orígenes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

let scores = [];

app.get('/', (req, res) => {
    res.send('Servidor Pixel-Hop Activo');
});

// Endpoint de lectura (responde lo mismo a cualquier pestaña)
app.get('/leaderboard', (req, res) => {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    return res.status(200).json(sorted);
});

// Endpoint para recibir puntajes
app.post('/score', (req, res) => {
    const { name, score } = req.body;

    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    const existingIndex = scores.findIndex(
        s => s.name.toLowerCase() === name.toLowerCase()
    );

    if (existingIndex !== -1) {
        if (score > scores[existingIndex].score) {
            scores[existingIndex].score = score;
        }
    } else {
        scores.push({ name, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return res.status(200).json({ success: true, scores });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
