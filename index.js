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

    const historicalArtifactCollection = client.db("hATracker").collection("historicalArtifacts");
    const likedHistoricalArtifactCollection = client.db("hATracker").collection("liked_historical_artifacts");

    app.get('/historicalArtifacts', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { adder_email: email };
      }
      const cursor = historicalArtifactCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/historicalArtifacts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalArtifactCollection.findOne(query);
      res.send(result);
    })

    app.post('/historicalArtifacts', async (req, res) => {
      const newArtifact = req.body;
      const result = await historicalArtifactCollection.insertOne(newArtifact);

      res.send(result);
    })

    // Liked Historical Artifacts APIs
    app.get('/liked-historical-artifact', async (req, res) => {
      const email = req.query.email;
      const query = { liked_by: email }
      const result = await likedHistoricalArtifactCollection.find(query).toArray();

      // fokira way to aggregate data
      for (const liking of result) {
        console.log(liking.artifact_id)
        const query1 = { _id: new ObjectId(liking.artifact_id) }
        const artifact = await historicalArtifactCollection.findOne(query1);
        if (artifact) {
          liking.artifact_name = artifact.artifact_name;
          liking.artifact_image = artifact.artifact_image;
          liking.like_count = artifact.like_count;
          liking.artifact_type = artifact.artifact_type;
        }
      }
      res.send(result);
    })

    app.post('/liked-historical-artifacts', async (req, res) => {
      const newLikedArtifact = req.body;
      const result = await likedHistoricalArtifactCollection.insertOne(newLikedArtifact);

      // Not the best way (use aggregate)
      const id = newLikedArtifact.artifact_id;
      const query = { _id: new ObjectId(id) }
      const artifact = await historicalArtifactCollection.findOne(query);
     
      // Now update the artifact info

      let newCount = 0;
      if (artifact.like_count) {
        newCount = artifact.like_count + 1;
      }
      else {
        newCount = 1;
      }

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          like_count: newCount
        }
      }
      const updateResult = await historicalArtifactCollection.updateOne(filter, updatedDoc);

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