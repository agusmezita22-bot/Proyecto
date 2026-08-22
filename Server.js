app.get('/api/leaderboard', async (req, res) => {
    const { tab } = req.query;

    let filter = "";
    if (tab === 'sem') {
        filter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
    } else if (tab === 'mes') {
        filter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
    }
    // Si es prov, nac o int (Global), muestra el ranking histórico completo sin filtro de fecha

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
