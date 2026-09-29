const express = require("express");
const axios = require("axios");
const path = require("path");

// usage of express, and joke API base URl
const app = express();
const PORT = process.env.PORT || 3000;
const JOKE_API_BASE = "https://v2.jokeapi.dev/joke";

// Flags for jokes
const CATEGORIES = [
  "Any",
  "Programming",
  "Misc",
  "Pun",
  "Spooky",
  "Christmas",
  "Dark",
];

const BLACKLIST_FLAGS = [
  "nsfw",
  "religious",
  "political",
  "racist",
  "sexist",
  "explicit",
];

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
// Home
app.get("/", (req, res) => {
  res.render("index", {
    categories: CATEGORIES,
    blacklistFlags: BLACKLIST_FLAGS,
    formData: {
      category: "Any",
      type: "any",
      contains: "",
      amount: "1",
      safeMode: true,
      blacklist: [],
    },
    jokes: null,
    error: null,
  });
});
// Joke fetching
app.post("/jokes", async (req, res) => {
  const category = req.body.category || "Any";
  const type = req.body.type || "any";
  const contains = (req.body.contains || "").trim();
  const amount = Math.min(Math.max(parseInt(req.body.amount, 10) || 1, 1), 10);
  const safeMode = req.body.safeMode === "on";

  let blacklist = req.body.blacklist || [];
  if (!Array.isArray(blacklist)) {
    blacklist = [blacklist];
  }

  const formData = {
    category,
    type,
    contains,
    amount: String(amount),
    safeMode,
    blacklist,
  };

  const renderWith = (payload) => {
    res.render("index", {
      categories: CATEGORIES,
      blacklistFlags: BLACKLIST_FLAGS,
      formData,
      ...payload,
    });
  };
  // make sure to validate
  if (!CATEGORIES.includes(category)) {
    return renderWith({
      jokes: null,
      error: "Please choose a valid joke category and try again.",
    });
  }

  try {
    const params = {
      amount,
    };

    if (type === "single" || type === "twopart") {
      params.type = type;
    }

    if (contains) {
      params.contains = contains;
    }

    if (blacklist.length > 0) {
      params.blacklistFlags = blacklist.join(",");
    }

    // JokeAPI safe mode flag
    if (safeMode) {
      params["safe-mode"] = "";
    }
    // Construct the API URL
    const url = `${JOKE_API_BASE}/${encodeURIComponent(category)}`;
    const response = await axios.get(url, { params, timeout: 10000 });
    const data = response.data;

    // handle errors
    if (data.error) {
      const details =
        (Array.isArray(data.causedBy) && data.causedBy.join(" ")) ||
        data.message ||
        "No jokes matched your filters.";

      return renderWith({
        jokes: null,
        error: `${details} Adjust your filters and try again.`,
      });
    }

    const jokes = data.jokes
      ? data.jokes
      : [
          {
            category: data.category,
            type: data.type,
            joke: data.joke,
            setup: data.setup,
            delivery: data.delivery,
            id: data.id,
            safe: data.safe,
            flags: data.flags,
          },
        ];

    return renderWith({ jokes, error: null });
  } catch (err) {
    let message =
      "Something went wrong while fetching jokes. Please try again.";

    if (err.response) {
      const apiError = err.response.data;
      message =
        apiError?.message ||
        apiError?.additionalInfo ||
        `JokeAPI returned status ${err.response.status}. Please try again.`;
    } else if (err.code === "ECONNABORTED") {
      message = "The request timed out. Please try again.";
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      message =
        "Could not reach JokeAPI. Check your internet connection and try again.";
    }

    return renderWith({ jokes: null, error: message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).render("index", {
    categories: CATEGORIES,
    blacklistFlags: BLACKLIST_FLAGS,
    formData: {
      category: "Any",
      type: "any",
      contains: "",
      amount: "1",
      safeMode: true,
      blacklist: [],
    },
    jokes: null,
    error: "Page not found. Use the form below to fetch some jokes.",
  });
});

// app listening
app.listen(PORT, () => {
  console.log(`Joke Finder running at http://localhost:${PORT}`);
});
