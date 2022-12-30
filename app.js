// import modules
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const date = require(__dirname + "/date.js");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// create app using express
const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({extended: true}));
app.use(express.static("public")); // static files are held inside the public folder

app.use(session(
    {
        secret: process.env.SECRET,
        resave: false,
        saveUninitialized: false
    }
));

app.use(passport.initialize());

app.use(passport.session());

// connect to database
const uri = process.env.URL;
mongoose.connect(uri, 
{
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// create a blogPostSchema
const blogPostSchema = {
    date: String,
    title: String,
    content: String,
    userId: String
};

// create a model
const BlogPost = mongoose.model("BlogPost", blogPostSchema);

// create a userSchema
const userSchema = new mongoose.Schema(
    {
        username: 
        {
            type: String
        },
        googleId: 
        {
            type: String
        },
        password: 
        {
            type: String
        },
        date:
        {
            type: Date,
            default: Date.now
        },
        authorName: 
        {
            type: Object
        }
    }
);

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// create user model
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: "https://daily-journal-app-cjt0.onrender.com/auth/google/dailyjournal",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        (accessToken, refreshToken, profile, cb) => {
            User.findOrCreate(
                {
                    googleId: profile.id,
                    username: profile.emails[0].value,
                    authorName: profile.name
                },
                (err, user) => {
                    return cb(err, user);
                }
            );
        }
    )
);

let navArr = [];

app.get("/google570badad679dbda8.html", (req, res) => {
    res.sendFile(__dirname + "/google570badad679dbda8.html");
});

app.get("/", (req, res) => {
    if(req.isAuthenticated())
    {
        navArr.push({item: "LOG OUT"});
        res.redirect("/userHome");
    }
    else
    {
        res.render("welcome", {navArr: navArr}); // maybe error
    }
});

app.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}));

app.get("/auth/google/dailyjournal",
    passport.authenticate("google", {failureRedirect: "/login"}),
    (req, res) => {
        res.redirect("/userHome");
    }
);

// register
app.get("/register", (req, res) => {
    res.render("register", {navArr: navArr});
});

// login
app.get("/login", (req, res) => {
    res.render("login", {navArr: navArr});
});

app.get("/logout", (req, res) => {
    req.logout();
    navArr = [];
    res.redirect("/");
});

app.get("/userHome", (req, res) => {
    if(req.isAuthenticated())
    {
        User.findById(req.user.id, (err, foundUser) => {
            if(err)
            {
                console.log(err);
            }
            else
            {
                if(foundUser)
                {
                    navArr.push({item: "LOG OUT"});
                    BlogPost.find({userId: foundUser._id})
                        .collation({locale: "ro"})
                        .sort({date: -1})
                        .exec((err, posts) => {
                            res.render("userHome", {posts: posts, navArr: navArr})
                        });
                }
            }
        });
    }
    else
    {
        res.redirect("/");
    }
});

// get request to the about route
app.get("/about", (req, res) => {
    if(req.isAuthenticated())
    {
        navArr.push({item: "LOG OUT"});
    }
    res.render("about", {navArr: navArr});
});

// get request to the compose route
app.get("/compose", (req, res) => {
    if(req.isAuthenticated())
    {
        navArr.push({item: "LOG OUT"});
        res.render("compose", {navArr: navArr});
    }
    else
    {
        res.redirect("/");
    }
});

app.get("/about", (req, res) => {
    res.render("about");
});

// express parameters for posts
app.get("/posts/:postId", (req, res) => {
    const requestedPostId = req.params.postId;

    if(req.isAuthenticated())
    {
        navArr.push({item: "LOG OUT"});
        BlogPost.findOne({_id: requestedPostId}, (err, post) => {
            res.render("post", 
                {
                    title: post.title,
                    content: post.content,
                    post: post,
                    navArr: navArr
                }
            );
        });
    }
    else
    {
        res.redirect("/");
    }
});

app.post("/register", (req, res) => {
    let errors = [];

    if(req.body.password.length < 6)
    {
        errors.push({msg: "Password should be at least 6 characters"});
    }

    if(errors.length > 0)
    {
        res.render("register", {errors: errors, navArr: navArr});
    }

    errors.pop();

    User.findOne({username: req.body.username}, (err, user) => {
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(user)
            {
                errors.push({msg: "User already registered... Log in"});

                if(errors.length > 0)
                {
                    res.render("register", {errors: errors, navArr: navArr});
                }
            }
            else
            {
                User.register({username: req.body.username}, req.body.password, (err, user) => {
                    if(err)
                    {
                        errors.push({msg: err.message});
                    }
                    else
                    {
                        passport.authenticate("local")(req, res, () => {
                            res.redirect("/userHome");
                        });
                    }
                });
            }
        }
    });
});

app.post("/login", (req, res) => {
    let errors = [];

    const user = new User(
        {
            username: req.body.username,
            password: req.body.password
        }
    );

    User.findOne({username: req.body.username}, (err, user) => {
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(!user)
            {
                errors.push({msg: "This email has not been registered"});
                res.render("login", {errors: errors, navArr: navArr});
            }
            else
            {
                req.login(user, (err) => {
                    if(err)
                    {
                        console.log(err);
                    }
                    else
                    {
                        passport.authenticate("local", {failureRedirect: "/login"})(req, res, () => {
                            res.redirect("/userHome");
                        });
                    }
                });
            }
        }
    });
});

// post request in the compose route 
app.post("/compose", (req, res) => {
    const time = date.getTime();

    const post = new BlogPost(
        {
            date: time,
            title: req.body.postTitle,
            content: req.body.postContent,
            userId: req.user.id 
        }
    )

    User.findById(req.user.id, (err, foundUser) => {
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(foundUser)
            {
                post.save((err) => {
                    if(!err)
                    {
                        res.redirect("/");
                    }
                });
            }
        }
    });
});

app.post("/delete", (req, res) => {
    const deletedPost = req.body.deletedPost;

    BlogPost.deleteOne({_id: deletedPost}, (err) => {
        if(!err)
        {
            res.redirect("/");
        }
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server started on port 3000.");
});
