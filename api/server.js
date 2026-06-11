const { MongoClient } = require('mongodb');

// Vercel környezeti változó beolvasása
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("HIBA: A MONGODB_URI környezeti változó hiányzik a Vercel beállításokból!");
}

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

module.exports = async (req, res) => {
  // CORS beállítások, hogy a böngésződ ne blokkolja
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const mongoClient = await clientPromise;
    const db = mongoClient.db('airsoft_ims'); // Az adatbázisod neve
    const usersCollection = db.collection('users');

    const { type } = req.query;

    // --- BEJELENTKEZÉS KEZELÉSE ---
    if (type === 'login' && req.method === 'POST') {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Hiányzó felhasználónév vagy jelszó!' });
      }

      // Felhasználó megkeresése (kis- és nagybetű függetlenül)
      const user = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });

      if (!user || user.password !== password) {
        return res.status(401).json({ error: '⚠️ bad auth : authentication failed' });
      }

      // Sikeres belépés visszaadása adatokkal
      return res.status(200).json({ 
        success: true, 
        role: user.role, 
        displayName: user.displayName || user.username 
      });
    }

    // Ha nincs eltalált útvonal
    return res.status(404).json({ error: 'Útvonal nem található' });

  } catch (error) {
    console.error("Szerver hiba történt:", error);
    return res.status(500).json({ error: 'Belső szerverhiba', details: error.message });
  }
};
