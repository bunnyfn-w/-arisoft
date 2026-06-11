import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client = null;

async function connectDB() {
  if (!client) {
    if (!uri) {
      throw new Error("A MONGODB_URI hianyzik a Vercel beallitasokbol!");
    }
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('airsoft_ims');
}

export default async function handler(req, res) {
  // CORS fixek
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
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      const { username, password } = body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Hianyzo adatok!' });
      }

      const user = await usersCollection.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });

      if (!user || user.password !== password) {
        return res.status(401).json({ error: '⚠️ bad auth : authentication failed' });
      }

      return res.status(200).json({ 
        success: true, 
        role: user.role, 
        displayName: user.displayName || user.username 
      });
    }

    return res.status(404).json({ error: 'Nem talalhato' });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Belso szerverhiba', 
      message: error.message 
    });
  }
}
