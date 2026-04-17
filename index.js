const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

// 1. CONFIGURATION FIREBASE
// Assure-toi que ton fichier serviceAccountKey.json est dans le même dossier
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// Middleware pour vérifier si l'utilisateur est bien connecté via Firebase
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Accès refusé. Token manquant." });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // On stocke les infos de l'utilisateur dans la requête
    next();
  } catch (error) {
    res.status(401).json({ error: "Token invalide ou expiré." });
  }
};

// --- ROUTES DE L'API ---

/**
 * @route   POST /api/groups
 * @desc    Créer une nouvelle tontine (Njangi)
 */
app.post('/api/groups', async (req, res) => {
  try {
    const { name, contribution, frequency, creatorId, creatorName } = req.body;

    const newGroup = {
      name,
      contribution: parseFloat(contribution),
      frequency: frequency || 'monthly',
      members: [{ id: creatorId, name: creatorName, joinedAt: new Date() }],
      adminId: creatorId,
      totalPot: 0,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      currentTurn: 0
    };

    const docRef = await db.collection('groups').add(newGroup);
    res.status(201).json({ id: docRef.id, ...newGroup });
  } catch (error) {
  console.error("DEBUG ERROR:", error); // Ceci affichera l'erreur précise dans ton terminal
  res.status(500).json({ error: error.message });
}
});

/**
 * @route   GET /api/groups/user/:userId
 * @desc    Récupérer les groupes d'un utilisateur spécifique
 */
app.get('/api/groups/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    // On cherche les groupes où l'ID de l'utilisateur est présent dans la liste des membres
    const snapshot = await db.collection('groups').get();
    
    const userGroups = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.members.some(m => m.id === userId)) {
        userGroups.push({ id: doc.id, ...data });
      }
    });

    res.status(200).json(userGroups);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des groupes" });
  }
});

/**
 * @route   PUT /api/groups/join/:groupId
 * @desc    Rejoindre un groupe existant
 */
app.put('/api/groups/join/:groupId', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const groupRef = db.collection('groups').doc(req.params.groupId);

    const doc = await groupRef.get();
    if (!doc.exists) return res.status(404).send("Groupe non trouvé");

    await groupRef.update({
      members: admin.firestore.FieldValue.arrayUnion({
        id: userId,
        name: userName,
        joinedAt: new Date()
      })
    });

    res.status(200).json({ message: "Bienvenue dans le groupe !" });
  } catch (error) {
    res.status(500).json({ error: "Impossible de rejoindre le groupe" });
  }
});

/**
 * @route   POST /api/transactions
 * @desc    Enregistrer une cotisation
 */
app.post('/api/transactions', async (req, res) => {
  try {
    const { userId, groupId, amount } = req.body;

    const transaction = {
      userId,
      groupId,
      amount: parseFloat(amount),
      date: admin.firestore.FieldValue.serverTimestamp(),
      type: 'contribution'
    };

    const docRef = await db.collection('transactions').add(transaction);
    res.status(201).json({ id: docRef.id, ...transaction });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la transaction" });
  }
});

// Tirage au sort
app.post('/api/groups', verifyToken, async (req, res) => {
  try {
    const { name, contribution, frequency, membersList } = req.body;

    // Logique de tirage au sort simple : on mélange la liste des membres
    const shuffledMembers = membersList
      .map(m => ({ ...m, order: 0 }))
      .sort(() => Math.random() - 0.5)
      .map((m, index) => ({ ...m, order: index + 1 }));

    const newGroup = {
      name,
      contribution: parseFloat(contribution),
      frequency,
      members: shuffledMembers,
      adminId: req.user.uid, // Utilise l'ID de l'utilisateur connecté via le token
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      currentTurn: 1
    };

    const docRef = await db.collection('groups').add(newGroup);
    res.status(201).json({ id: docRef.id, ...newGroup });
  } catch (error) {
    console.error("Erreur creation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/pay
 * @desc    Enregistrer une cotisation et mettre à jour le pot du groupe
 */
app.post('/api/pay', verifyToken, async (req, res) => {
  try {
    const { groupId, amount, contributorName } = req.body;
    const userId = req.user.uid; // Récupéré via le middleware verifyToken

    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: "Groupe non trouvé" });
    }

    // Créer la transaction
    const transaction = {
      userId,
      userName: contributorName,
      groupId,
      amount: parseFloat(amount),
      date: admin.firestore.FieldValue.serverTimestamp(),
      type: 'contribution'
    };

    // Utilisation d'un "Batch" pour garantir que si l'un échoue, l'autre aussi
    const batch = db.batch();
    
    // Ajouter la transaction
    const transRef = db.collection('transactions').doc();
    batch.set(transRef, transaction);

    // Mettre à jour le pot total du groupe
    batch.update(groupRef, {
      totalPot: admin.firestore.FieldValue.increment(parseFloat(amount))
    });

    await batch.commit();

    res.status(200).json({ 
      message: "Cotisation enregistrée avec succès !",
      transactionId: transRef.id 
    });
    

  } catch (error) {
    console.error("Erreur paiement:", error);
    res.status(500).json({ error: "Erreur lors du traitement du paiement" });
  }
});

// Voir l'etat du pot
app.get('/api/groups/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('groups').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send("Groupe inexistant");
    
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  --------------------------------------------------
   Serveur NJANGI-PAY opérationnel !
   Port : ${PORT}
   Base de données : Firebase Firestore
  --------------------------------------------------
  `);
});