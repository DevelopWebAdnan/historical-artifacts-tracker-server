const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://historical-artifacts-tra-28e05.web.app",
    "https://historical-artifacts-tra-28e05.firebaseapp.com"
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  // console.log('In the verify token middleware', req.cookies)
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }

  // verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
  })
  next();
}


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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const historicalArtifactCollection = client.db("hATracker").collection("historicalArtifacts");
    const likedHistoricalArtifactCollection = client.db("hATracker").collection("liked_historical_artifacts");

    // Auth related APIs
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

        })
        .send({ success: true });
    });

    app.post('/logout', (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

        })
        .send({ success: true })
    });

    // Historical artifacts related APIs
    app.get('/historicalArtifacts', async (req, res) => {

      // console.log(req.cookies?.token);
      // if token email !== query email
      // if (req.user.email !== req.query.email) {
      //   return res.status(403).send({ message: "Forbidden Access" });
      // }

      // const email = req.query.email;
      // let query = {};
      // if (email) {
      //   query = { adder_email: email };
      // }

      // const cursor = historicalArtifactCollection.find(query);
      const cursor = historicalArtifactCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/myHistoricalArtifacts/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { adder_email: email };
      const cursor = historicalArtifactCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/historicalArtifacts/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalArtifactCollection.findOne(query);
      res.send(result);
    })

    app.post('/historicalArtifacts', verifyToken, async (req, res) => {
      const newArtifact = req.body;
      const result = await historicalArtifactCollection.insertOne(newArtifact);

      res.send(result);
    })

    app.put('/historicalArtifact/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedArtifact = req.body;
      const artifact = {
        $set: {
          artifact_name: updatedArtifact.artifact_name,
          artifact_image: updatedArtifact.artifact_image,
          artifact_type: updatedArtifact.artifact_type,
          historical_context: updatedArtifact.historical_context,
          created_at: updatedArtifact.created_at,
          discovered_at: updatedArtifact.discovered_at,
          discovered_by: updatedArtifact.discovered_by,
          present_location: updatedArtifact.present_location
        }
      }
      const result = await historicalArtifactCollection.updateOne(filter, artifact, options);
      res.send(result);
    })

    app.delete('/historicalArtifact/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await historicalArtifactCollection.deleteOne(query);
      res.send(result);
    })

    // Liked Historical Artifacts APIs
    app.get('/liked-historical-artifact', verifyToken, async (req, res) => {

      console.log(req.cookies?.token);
      // if token email !== query email
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

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
      // const isLiked = req.query.like;


      const newLikedArtifact = req.body;
      const result = await likedHistoricalArtifactCollection.insertOne(newLikedArtifact);

      // Not the best way (use aggregate)
      const id = newLikedArtifact.artifact_id;
      const query = { _id: new ObjectId(id) }
      const artifact = await historicalArtifactCollection.findOne(query);

      // Now update the artifact info

      // let newCount = 0;
      // if (artifact.like_count) {
        // if (isLiked === 'true') {
        newCount = artifact.like_count + 1;
        // }else {
        //   newCount = artifact.like_count - 1;
        // }
      // }
      // else {
        // newCount = 1;
      // }

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          like_count: newCount
        }
      }
      const updateResult = await historicalArtifactCollection.updateOne(filter, updatedDoc);

      res.send(result);
    })

    app.patch('/liked-historical-artifacts/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const artifact = await historicalArtifactCollection.findOne(filter);
      // let newCount = 0;
      // let newCount;
      // if (artifact.like_count) {
      // if (isLiked === 'true') {
      // newCount = artifact.like_count + 1;
      // }else {
      newCount = artifact.like_count - 1;
      // }
      // }
      // else {
      //   newCount = 1;
      // }

      const updatedStatus = {
        $set: {
          like_count: newCount
          // like_count: like_count - 1
        }
      }
      const result = await historicalArtifactCollection.updateOne(filter, updatedStatus);
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