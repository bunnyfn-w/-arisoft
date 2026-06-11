const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
let client = null;

async function connectDB() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('airsoft_ims');
}

module.exports = async (req, res) => {
  // CORS engedélyezése
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await connectDB();
    const usersCollection = db.collection('users');
    const { type } = req.query;

    if (type === 'login' && req.method === 'POST') {
      // Ha a req.body stringként jönne be, átalakítjuk JSON-ná
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const { username, password } = body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Hiányzó adatok!' });
      }

      // Felhasználó keresése
      const user = await usersCollection.findOne({ username: username.toLowerCase() });

      if (!user || user.password !== password) {
        return res.status(401).json({ error: '⚠️ bad auth : authentication failed' });
      }

      return res.status(200).json({ 
        success: true, 
        role: user.role, 
        displayName: user.displayName || user.username 
      });
    }

    return res.status(404).json({ error: 'Nem található' });

  } catch (error) {
    // Ha bármi hiba van, KÖTELEZŐEN küldje vissza a böngészőnek is, hogy lásd!
    return res.status(500).json({ 
      error: 'Belső szerverhiba történt!', 
      details: error.message,
      stack: error.stack
    });
  }
};
