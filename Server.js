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
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicialización e intento de conexión a PostgreSQL
const initDb = async () => {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                score INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        client.release();
        console.log("Conexión a base de datos exitosa y tabla verificada.");
    } catch (err) {
        console.error("Error al conectar con la base de datos PostgreSQL:", err.message);
    }
};
initDb();

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.post('/api/score', async (req, res) => {
    const { playerName, score } = req.body;

    console.log(`Petición recibida - Nombre: ${playerName}, Score: ${score}`);

    if (!playerName || score === undefined || score === null) {
        return res.status(400).json({ error: "Faltan datos obligatorios (playerName o score)" });
    }

    try {
        const query = 'INSERT INTO leaderboard (player_name, score) VALUES ($1, $2) RETURNING *';
        const values = [String(playerName).trim(), parseInt(score, 10)];
        const result = await pool.query(query, values);
        
        console.log("Puntaje guardado exitosamente:", result.rows[0]);
        res.status(200).json({ status: "ok", data: result.rows[0] });
    } catch (err) {
        console.error("Error al insertar en la base de datos:", err.message);
        res.status(500).json({ error: "Error en base de datos", details: err.message });
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
        console.error("Error al consultar posiciones:", err.message);
        res.status(200).json([]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
