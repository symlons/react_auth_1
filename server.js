const express = require("express");
const https = require("https");
const fs = require("fs");
const { doubleCsrf } = require("csrf-csrf");

let session = require("express-session");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const { User_auth, User_data } = require("./models");
const { check_password } = require("./checkUser");
const { OAuth2Client } = require("google-auth-library");

let RedisStore = require("connect-redis")(session);
require("dotenv").config();
//const https = require("https");
const axios = require("axios");
const jwt_decode = require('jwt-decode');

const Redis = require("ioredis");
const { expressjwt: jwt } = require("express-jwt");

const redisClient = new Redis({
  port: process.env.REDIS_PORT, // Redis port
  host: process.env.REDIS_HOST, // Redis host
  password: process.env.REDIS_PASSWORD,
  db: 0, // Defaults to 0
});

let app = express();
mongoose.set("strictQuery", false);
mongoose.connect(process.env.MONGOOSE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

app.use(function (req, res, next) {
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN);
  res.setHeader("X-Frame-Options", "DENY"); // prevents click-jacking //X-Forward for proxy?
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31556952000; includeSubDomains"
  ); // rquires SSL
  res.setHeader("X-Content-Type-Options", "nosniff");
  return next();
});

app.use(async (req, res, next) => {
  if (!(req.session && req.session.userId)) {
    return next();
  }
  const user = await User_data.findById(req.session.userId);
  if (!user) {
    return next();
  }
  req.user = user;
  next();
});

app.use(
  session({
    name: "session_cookie", // requires SSL
    store: new RedisStore({
      client: redisClient,
    }),
    secret: process.env.SESSION_COOKIE_SECRET,
    rolling: true, //lifetime of cookie will be extended after each new request with that cookie
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true, // during development (client side scripts can't use that cookie e.g. isn't like a cookie to determine if user prefers dark or light mode)
      proxy: true,
      secure: true, // during development (requires SSL)
      sameSite: "strict", // does not prevent same site but cross origin requests
      maxAge: 1000 * 60 * 120, //after 2 hours without use the session will be deleted from redis
      overwrite: true,
    },
  })
);

const CSRF_COOKIE_NAME = "x-csrf-token";

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: (req) => req.secret,
    secret: process.env.CSRF_SECRET,
    cookieName: CSRF_COOKIE_NAME,
    cookieOptions: { sameSite: "strict", secure: true, signed: true },
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getTokenFromRequest: (req) => req.headers["x-csrf-token"],
  });

app.use(cookieParser(process.env.COOKIES_SECRET));

const csrfErrorHandler = (error, req, res, next) => {
  console.log("invalid csrf");
  if (error == invalidCsrfTokenError) {
    res.status(403).json({
      error: "csrf validation error",
    });
  } else {
    next();
  }
};

app.get("/csrf", (req, res) => {
  // per session csrf is secure enough, could use per request but back button won't work
  // could at least change csrf token after login
  const csrfToken = generateToken(res, req);
  res.json({ csrfToken });
});

app.get("/nonce", (req, res) => {
  require("crypto").randomBytes(48, function (err, buffer) {
    var nonce = buffer.toString("hex");
    req.session.nonce = nonce;
    res.json(nonce);
  });
});

app.get("/state", (req, res) => {
  require("crypto").randomBytes(48, function (err, buffer) {
    var g_state = buffer.toString("hex");
    req.session.g_state = g_state;
    res.json(g_state);
  });
});

app.get("/gauth", async (req, res) => {
  console.log('auth request')
  if (req.query.state === req.session.g_state) {
    const body = {
      code: req.query.code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: "https://127.0.0.1:443/gauth",
      grant_type: "authorization_code",
    };

    const url = "https://oauth2.googleapis.com/token";
    const g_auth_response = await axios
      .post(url, body)
      .then((res) => {
        return res;
      })
      .catch(function (error) {
        console.log(error.response.data);
        return error;
      });

    const ID_token = g_auth_response.data.id_token;
    let decoded = jwt_decode(ID_token) 
    console.log(decoded)
    console.log(g_auth_response)
    // also check nonce

    res.status(200);
    res.end();
  }
  //check if account exists
  //res.redirect("https://localhost:5173");
});

app.post("/login", doubleCsrfProtection, csrfErrorHandler, async (req, res) => {
  let origin = req.get("origin");
    console.log(process.env.ALLOW_ORIGIN)
    console.log(origin)
  if (origin != process.env.ALLOW_ORIGIN) {
    console.log("Invalid origin");
    res.status(403);
    res.send("Please try again later!");
  } else {
    req.body.email = DOMPurify.sanitize(req.body.email); // sanitizes the data to prevent XSS
    req.body.password = DOMPurify.sanitize(req.body.password);
    try {
      const user = await User_auth.findOne({
        email: req.body.email,
      });

      if (user) {
        console.log("correct email");
        const match = await check_password(req.body.password, user.password);
        if (match) {
          req.session.regenerate((err) => {
            // TODO: CHECK IF TRUE: seems to create new session id without deleting the old one
            // will update the sessionID to protect against session fixation attacks but the session data will get lost
            req.session.userId = user._id;
            console.log("user successfully logged in");
            res.status(200);
            res.send({ message: "you successfully logged in" });
            res.end();
          });
        } else {
          res.status(403);
          console.log("invalid password");
          res.send({ message: "invalid email or password" });
          res.end();
        }
      } else {
        res.status(403);
        res.send({ message: "invalid email or password" });
        res.end();
      }
    } catch (err) {
      console.log("An error occured error");
      console.log(err);
      res.end();
    }
  }
});

const key = fs.readFileSync(process.env.SSL_KEY);
const cert = fs.readFileSync(process.env.SSL_CERT);
const options = {
  key: key,
  cert: cert,
};

// HTTPS (SSL)
let https_server = https
  .createServer(options, app)
  .listen(process.env.HTTPS_PORT);
console.log("HTTPS Port: 443");
https_server.keepAliveTimeout = 61 * 1000; // (61 seconds)
