const mongoose = require("mongoose");
require("../db/mongodb");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    tokens: [
      {
        token: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.methods.generateAuthToken = async function () {
  const token = jwt.sign({ _id: String(this._id) }, process.env.JWT_SECRET); 
  this.tokens.push({ token });
  this.save();
  return token;
};
const User = mongoose.model("User", userSchema);
module.exports = User;
