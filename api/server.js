import { MongoClient, ObjectId } from 'mongodb';

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
    const { type } = req.query;

    // ==========================================
    // 1. BEJELENTKEZÉS KEZELÉSE
    // ==========================================
    if (type === 'login' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { username, password } = body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Hianyzo adatok!' });
      }

      const user = await db.collection('users').findOne({ 
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

    // ==========================================
    // 2. RENDELÉSI LISTA LEKÉRÉSE (GET)
    // ==========================================
    if (type === 'get_orders' && req.method === 'GET') {
      const orders = await db.collection('orders').find({}).toArray();
      return res.status(200).json(orders);
    }

    // ==========================================
    // 3. ÚJ TERMÉK HOZZÁADÁSA A LISTÁHOZ (POST)
    // ==========================================
    if (type === 'add_order' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { name, link } = body;

      if (!name || !link) {
        return res.status(400).json({ error: 'A nev és a link kötelezo!' });
      }

      const newOrder = {
        name,
        link,
        createdAt: new Date()
      };

      await db.collection('orders').insertOne(newOrder);
      return res.status(201).json({ success: true, message: 'Termék hozzáadva!' });
    }

    return res.status(404).json({ error: 'Nem talalhato útvonal' });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Belso szerverhiba', 
      message: error.message 
    });
  }
}
