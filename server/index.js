const express = require("express");
const cors = require('cors')
const mysql = require("mysql");
const bcrypt = require("bcryptjs/dist/bcrypt");
const CryptoJS = require("crypto-js");
const nodemailer = require('nodemailer');
require('dotenv').config();

let CheckPassword;

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(cors())

const genRand = (len) => {
  return Math.random().toString(36).substring(2,len+2);
}

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yarinmzrc@gmail.com',
    pass: process.env.PASSWORD_MAIL
  }
});





const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'communication_ltd'
})

db.connect(err => {
  if(err) {
    throw err;

  }

  console.log('MySql connected')
  createTables();
})

app.post('/create-user', async(req, res) => {
  const {email, password} = req.body.userDetails;
  let sql = `SELECT * from users WHERE email=?`;
  db.query(sql, email, async (err, result) => {
    if(err) {
      throw err;
    }
    if(result.length) {
      res.send("user already registered")
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      db.query(`INSERT INTO users VALUES (?,?,?)`, [email, hashedPassword,'[]'], (err, result)=>{
        if(err) throw err;
        db.query(`SELECT * FROM users WHERE email=?`, email, (err, result) => {
          if(err) throw err;
          if(result){
            res.send(result[0])
          }
        })
      })
    }
  })
})

app.post('/login-user', async(req, res) => {
  const {email, password} = req.body.userDetails;
  let sql = `SELECT * from users WHERE email=?`;
  db.query(sql, email, async(err, result) => {
    if(err) throw err;
    if(result.length) {
      const userFound=JSON.parse(JSON.stringify(result[0]));
      if( await bcrypt.compare(password, userFound.password)) {
        res.send(userFound);
      } else {
        res.send("Not Authenticated");
      }
    }
  })
})

app.get('/forgot-password', async(req,res) => {
  const string = genRand(12);
  const hash = CryptoJS.SHA1(string);
  const result = CryptoJS.enc.Hex.stringify(hash);

  var mailOptions = {
    from: 'yarinmzrc@gmail.com',
    to: 'yarinmzrc@gmail.com',
    subject: 'Your New Password Is Here!',
    text: result
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
      CheckPassword = result;
      res.send(result)
    }
  });

})

app.post('/change-password', async (req,res) => {
  const {email, password} = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  let sql = `UPDATE users SET password=? WHERE email=?`;
  db.query(sql, [hashedPassword,email], async(err, result) => {
    if(err) throw err;
    if(result.affectedRows === 1) {
      db.query(`SELECT * FROM users WHERE email=?`, email, (err, result) => {
        if(err) throw err;
        if(result){
          res.send(result[0])
        }
      })
    }
  })

})

app.post('/add-customer', async(req,res) => {
  const {customerData, email} = req.body;
  const customers = JSON.stringify(customerData);
  let sql = `UPDATE users SET customers=? WHERE email=?`;
  db.query(sql, [customers,email], async(err,result) =>{
    if(err) throw err;
    if(result) {
      res.send(result);
    }
  })

})

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

const createTables = () => {
  let sql = 'CREATE TABLE IF NOT EXISTS users (email VARCHAR(50), password TEXT, customers JSON)';
  db.query(sql, (err, result) => {
    if(err){
      throw err;
    }
    console.log('Create users table success')
  })
}