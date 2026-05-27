const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wy5hpga.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const historicalArtifactsCollection = client.db("hATracker").collection("historicalArtifacts");

    app.get('/historicalArtifacts', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { adder_email: email };
      }
      const cursor = historicalArtifactsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/historicalArtifacts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalArtifactsCollection.findOne(query);
      res.send(result);
    })

    app.post('/historicalArtifacts', async (req, res) => {
      const newArtifact = req.body;
      const result = await historicalArtifactsCollection.insertOne(newArtifact);
      res.send(result);
    })



  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send("We are tracking historical artifacts.");
})

app.listen(port, () => {
  console.log(`Historical artifacts are being tracked on: ${port}`);
})