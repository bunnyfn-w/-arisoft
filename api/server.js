import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;
let clientPromise;

if (!uri) {
    throw new Error('Kérlek add meg a MONGODB_URI környezeti változót!');
}

if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const mongoClient = await clientPromise;
        const db = mongoClient.db('airsoft_ims');
        const productsCollection = db.collection('products');
        const salesCollection = db.collection('sales');
        const usersCollection = db.collection('users'); // Új kollekció a felhasználóknak

        const { type } = req.query;

        // --- POST: Bejelentkezés ellenőrzése és Adatmentések ---
        if (req.method === 'POST') {
            
            // BEJELENTKEZÉS LOGIKA
            if (type === 'login') {
                const { username, password } = req.body;
                
                // Megkeressük a felhasználót az adatbázisban (kisbetűsítve a biztonság kedvéért)
                const user = await usersCollection.findOne({ username: username.toLowerCase() });
                
                // Ellenőrizzük a jelszót (Élesben ide jelszó-hashelés kéne, pl. bcrypt, de kiindulásnak ez tökéletes)
                if (user && user.password === password) {
                    return res.status(200).json({
                        success: true,
                        role: user.role,
                        displayName: user.displayName
                    });
                } else {
                    return res.status(401).json({ success: false, error: 'Hibás felhasználónév vagy jelszó!' });
                }
            }

            if (type === 'addProduct') {
                const newProduct = req.body;
                await productsCollection.insertOne(newProduct);
                return res.status(201).json({ message: 'Termék hozzáadva!' });
            }

            if (type === 'recordSale') {
                const saleData = req.body;
                const product = await productsCollection.findOne({ id: saleData.productId });
                if (!product || product.stock < saleData.quantity) {
                    return res.status(400).json({ error: 'Nincs elég készlet!' });
                }
                await productsCollection.updateOne(
                    { id: saleData.productId },
                    { $inc: { stock: -saleData.quantity } }
                );
                await salesCollection.insertOne(saleData);
                return res.status(201).json({ message: 'Eladás rögzítve!' });
            }
        }

        // --- GET: Adatok lekérése ---
        if (req.method === 'GET') {
            if (type === 'products') {
                const products = await productsCollection.find({}).toArray();
                return res.status(200).json(products);
            }
            if (type === 'sales') {
                const sales = await salesCollection.find({}).toArray();
                return res.status(200).json(sales);
            }
        }

        // --- DELETE: Törlés ---
        if (req.method === 'DELETE' && type === 'deleteProduct') {
            const { id } = req.body;
            await productsCollection.deleteOne({ id: id });
            return res.status(200).json({ message: 'Termék törölve!' });
        }

        return res.status(400).json({ error: 'Ismeretlen kérés' });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
