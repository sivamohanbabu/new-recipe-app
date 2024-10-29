const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");

// Initialize Express app
const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads')); // Serve image uploads

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/recipeApp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Specify the upload directory

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

// Recipe Schema
const RecipeSchema = new mongoose.Schema({
  title: String,
  ingredients: [String],
  instructions: String,
  imageUrl: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Models
const User = mongoose.model("User", UserSchema);
const Recipe = mongoose.model("Recipe", RecipeSchema);

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1]; // Get the token from the header
  if (token) {
    jwt.verify(token, "your_jwt_secret", (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(403);
  }
};

// Register Route
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const newUser = await User.create({ name, email, password: hashedPassword });
    const token = jwt.sign({ id: newUser._id }, "your_jwt_secret");
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: "User already exists." });
  }
});

// Login Route
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign({ id: user._id }, "your_jwt_secret");
    res.json({ token });
  } else {
    res.status(400).json({ error: "Invalid credentials." });
  }
});

// Recipe Routes
app.post("/auth/recipe", authenticateJWT, upload.single('image'), async (req, res) => {
  const { title, ingredients, instructions } = req.body;
  const imageUrl = req.file ? `http://localhost:4000/uploads/${req.file.filename}` : null; // Ensure the image URL is publicly accessible

  const recipe = new Recipe({ 
    title, 
    ingredients, 
    instructions, 
    imageUrl, 
    userId: req.user.id 
  });
  
  try {
    await recipe.save();
    res.status(201).json(recipe);
  } catch (error) {
    console.error("Error saving recipe:", error);
    res.status(500).json({ message: "Error adding recipe" });
  }
});

// Get Recipes
app.get("/auth/recipe", authenticateJWT, async (req, res) => {
  try {
    const recipes = await Recipe.find({ userId: req.user.id });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: "Error fetching recipes" });
  }
});

// Delete Recipe
app.delete("/auth/recipe/:id", authenticateJWT, async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ message: "Error deleting recipe" });
  }
});

// Search Recipes
app.get("/auth/searchRecipes/:query", authenticateJWT, async (req, res) => {
  try {
    const recipes = await Recipe.find({
      title: new RegExp(req.params.query, "i"),
      userId: req.user.id,
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: "Error searching recipes" });
  }
});
// Update Recipe
app.put("/auth/recipe/:id", authenticateJWT, async (req, res) => {
    const { title, ingredients, instructions } = req.body;
    try {
      const updatedRecipe = await Recipe.findByIdAndUpdate(req.params.id, {
        title,
        ingredients,
        instructions,
      }, { new: true });
      res.json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ message: "Error updating recipe" });
    }
  });
  
// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
