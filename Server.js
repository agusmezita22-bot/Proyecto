const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                score INT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla de posiciones lista.");
    } catch (err) {
        console.error("Error inicializando DB:", err);
    }
};
initDb();

app.post('/api/score', async (req, res) => {
    try {
        const { name, score } = req.body;
        if (!name || typeof score !== 'number') {
            return res.status(400).json({ error: 'Datos inválidos.' });
        }

        const checkUser = await pool.query('SELECT * FROM scores WHERE LOWER(name) = LOWER($1)', [name]);

        if (checkUser.rows.length > 0) {
            if (score > checkUser.rows[0].score) {
                await pool.query(
                    'UPDATE scores SET score = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(name) = LOWER($2)',
                    [score, name]
                );
            }
        } else {
            await pool.query('INSERT INTO scores (name, score) VALUES ($1, $2)', [name, score]);
        }

        res.status(200).json({ success: true, message: 'Puntaje guardado.' });
    } catch (error) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const tab = req.query.tab || 'sem';
        let query = 'SELECT name, score FROM scores ';

        if (tab === 'sem') {
            query += "WHERE updated_at >= NOW() - INTERVAL '7 days' ";
        } else if (tab === 'mes') {
            query += "WHERE updated_at >= NOW() - INTERVAL '30 days' ";
        }

        query += 'ORDER BY score DESC LIMIT 50';

        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener rankings.' });
    }
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
