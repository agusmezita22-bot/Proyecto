const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path'); // <-- AGREGADO

const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a la base de datos PostgreSQL de Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializar la tabla si no existe
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                score INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabla de récords verificada/creada con éxito.');
    } catch (err) {
        console.error('Error al inicializar la base de datos:', err);
    }
};
initDb();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Servir la carpeta raíz como archivos estáticos
app.use(express.static(path.join(__dirname)));

// Endpoint específico para servir ads.txt de AdSense
app.get('/ads.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'ads.txt'));
});

app.get('/', (req, res) => {
    // Si tienes un index.html en la raíz, es recomendable enviarlo aquí:
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint de lectura adaptado a las pestañas (Semanal, Mensual, Global, etc.)
app.get('/leaderboard', async (req, res) => {
    const { tab } = req.query;
    let timeFilter = '';

    if (tab === 'sem') {
        timeFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    } else if (tab === 'mes') {
        timeFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    }

    try {
        const query = `
            SELECT name, score 
            FROM scores 
            ${timeFilter} 
            ORDER BY score DESC 
            LIMIT 50
        `;
        const result = await pool.query(query);
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al consultar la tabla de récords' });
    }
});

// Endpoint para guardar/actualizar puntaje
app.post('/score', async (req, res) => {
    const { name, score } = req.body;

    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    try {
        await pool.query(`
            INSERT INTO scores (name, score)
            VALUES ($1, $2)
            ON CONFLICT (name) 
            DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score),
                          created_at = CURRENT_TIMESTAMP;
        `, [name, score]);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al guardar puntaje' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
