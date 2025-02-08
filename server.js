const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const path = require("path");
dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json()); 

app.use(express.json());  // Correct Middleware
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://127.0.0.1:27017/gaming_db", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ Database connection error:", err));
 

const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    bio: { type: String, default: "" },
    avatar: { type: String, default: "/uploads/default-avatar.png" },
    registeredGames: [{ 
        gameTitle: String, 
        gameImage: String, 
        tournamentDetails: String, 
        region: String, 
        timeSlot: String 
    }]
});


const User = mongoose.model("User", UserSchema);

// Signup Route
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    
    await newUser.save();
    res.json({ message: "User registered successfully" });
});

// Login Route
app.post("/login", async (req, res) => {
    try {
        console.log("Received request body:", req.body); // Debugging line

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, "secret", { expiresIn: "1h" });
        res.json({ message: "Login successful",  token, username: user.username });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});




// Update profile route to also return the user's bio
app.get("/profile", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, "secret");
        const user = await User.findById(decoded.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            username: user.username,
            bio: user.bio,
            avatar: user.avatar || "/uploads/default-avatar.png",
            registeredGames: user.registeredGames || []
        });
    } catch (error) {
        res.status(500).json({ message: "Invalid token or session expired" });
    }
});



// Update avatar route (Save selected avatar)
app.post("/profile/avatar", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, "secret");
        const user = await User.findById(decoded.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        // Save selected avatar in the database
        user.avatar = req.body.avatar;
        await user.save();

        res.json({ message: "Avatar updated successfully", avatar: user.avatar });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// Update bio route (Save new bio)
app.post("/profile/bio", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Extract token

        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, "secret"); // Verify token
        const user = await User.findById(decoded.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        user.bio = req.body.bio; // Update bio
        await user.save(); // Save to database

        res.json({ message: "Bio updated successfully", bio: user.bio });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/register-game", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Extract token
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, "secret"); // Verify token
        const user = await User.findById(decoded.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        const { gameTitle, gameImage, tournamentDetails, region, timeSlot } = req.body;

        // Check if the user is already registered for the game
        const isAlreadyRegistered = user.registeredGames.some(game => game.gameTitle === gameTitle);

        if (isAlreadyRegistered) {
            return res.status(400).json({ message: "You have already registered for this game." });
        }

        // If not registered, add the game to their registered list
        const newGame = { gameTitle, gameImage, tournamentDetails, region, timeSlot };
        user.registeredGames.push(newGame);
        await user.save();

        res.json({ message: "Game registered successfully", registeredGames: user.registeredGames });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});



app.listen(3000, () => console.log("Server running on port 3000"));

