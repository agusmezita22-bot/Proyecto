const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                score INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla lista.");
    } catch (err) {
        console.error("Error init DB:", err);
    }
};
initDb();

app.post('/api/score', async (req, res) => {
    const { playerName, score } = req.body;

    if (!playerName || score === undefined || score === null) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    try {
        await pool.query(
            'INSERT INTO leaderboard (player_name, score) VALUES ($1, $2)',
            [String(playerName).trim(), parseInt(score, 10)]
        );
        res.status(200).json({ status: "ok" });
    } catch (err) {
        console.error("Error insert:", err);
        res.status(500).json({ error: "Error interno" });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    const { tab } = req.query;

    let filter = "";
    if (tab === 'sem') {
        filter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    } else if (tab === 'mes') {
        filter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    }

    const query = `
        SELECT player_name AS name, MAX(score) AS score 
        FROM leaderboard 
        ${filter}
        GROUP BY player_name 
        ORDER BY score DESC 
        LIMIT 10
    `;

    try {
        const result = await pool.query(query);
        res.status(200).json(result.rows || []);
    } catch (err) {
        console.error("Error select:", err);
        res.status(200).json([]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor listo en ${PORT}`));
