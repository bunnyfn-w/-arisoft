import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client = null;

async function connectDB() {
  if (!client) {
    if (!uri) throw new Error("A MONGODB_URI hianyzik!");
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db('airsoft_ims');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectDB();
    const { type, id } = req.query;

    // 1. BEJELENTKEZÉS
    if (type === 'login' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { username, password } = body;

      const user = await db.collection('users').findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });

      if (!user || user.password !== password) {
        return res.status(401).json({ error: '⚠️ Authentication failed' });
      }
      
      // FORDÍTOTT LOGIKA: Alapból mindenki 'admin', kivéve ha a DB-ben DIREKT 'user' van megadva rangként
      const userRole = user.role === 'user' ? 'user' : 'admin'; 

      return res.status(200).json({ 
        success: true, 
        displayName: user.displayName || user.username,
        role: userRole 
      });
    }

    // ================= RAKTÁR (INVENTORY) KEZELÉS =================
    if (type === 'get_inventory' && req.method === 'GET') {
      const items = await db.collection('inventory').find({}).toArray();
      return res.status(200).json(items);
    }

    if (type === 'add_item' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { name, quantity, buyPrice, sellPrice, link, img } = body;

      const newItem = {
        name,
        quantity: parseInt(quantity) || 0,
        buyPrice: parseFloat(buyPrice) || 0,
        sellPrice: parseFloat(sellPrice) || 0,
        link: link || '',
        img: img || '',
        createdAt: new Date()
      };
      await db.collection('inventory').insertOne(newItem);
      return res.status(201).json({ success: true });
    }

    if (type === 'delete_item' && req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Hianyzik az ID' });
      await db.collection('inventory').deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    // ================= RENDELÉSI LISTA (ORDERS) KEZELÉS =================
    if (type === 'get_orders' && req.method === 'GET') {
      const orders = await db.collection('orders').find({}).toArray();
      return res.status(200).json(orders);
    }

    if (type === 'add_order' && req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { name, link, quantity } = body;

      const newOrder = {
        name,
        link: link || '',
        quantity: parseInt(quantity) || 1,
        createdAt: new Date()
      };
      await db.collection('orders').insertOne(newOrder);
      return res.status(201).json({ success: true });
    }

    if (type === 'delete_order' && req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Hianyzik az ID' });
      await db.collection('orders').deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Utvonal nem talalhato' });

  } catch (error) {
    return res.status(500).json({ error: 'Szerverhiba', message: error.message });
  }
}
