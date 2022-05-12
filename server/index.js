const express = require("express");
const cors = require('cors')
const mysql = require("mysql");
const bcrypt = require("bcryptjs/dist/bcrypt");
const CryptoJS = require("crypto-js");
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const config = require('./config.json');
require('dotenv').config();
const https = require("https");
const fs = require("fs");
const { constants } = require('crypto')
const options = {
  key: fs.readFileSync("C:\\Users\\yarin\\privateKey.key"),
  cert: fs.readFileSync("C:\\Users\\yarin\\certificate.crt"),
  secureOptions: constants.SSL_OP_NO_TLSv1_0| constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1_1 | constants.SSL_OP_NO_TLSv1_1,
  requestCert: true,
  rejectUnauthorized: false,
};

const PORT = process.env.PORT || 3001;

let countNumOfPassword = 0;

const app = express();
app.use(express.json());
app.use(cors())

const genRand = (len) => {
  return Math.random().toString(36).substring(2,len+2);
}

const generateToken = (id) => {
  return jwt.sign({id}, process.env.JWT_SECRET, {
    expiresIn: '30d'
  })
}

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'comltdhit@gmail.com',
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
  try { 
    const {email, password} = req.body.userDetails;
    const checkPassword = validator.isStrongPassword(password, config);

    if(!checkPassword) {
      countNumOfPassword ++;
      if(countNumOfPassword === config.passwordHistory) {
        res.send("You Riched the top of the attempts");
        return;
      }
      res.send("Password is Not Valid");
      return;
    };
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
      
      db.query(`INSERT INTO users(email,password,customers) VALUES (?,?,?)`, [email, hashedPassword,"[]"], (err, result)=>{
        if(err) throw err;
        db.query(`SELECT * FROM users WHERE email=?`, email, (err, result) => {
          if(err) throw err;
          if(result){
            countNumOfPassword = 0;
            const user = {...result[0], token: generateToken(result[0].id)};
            res.send(user)
          }
        })
      })
    }
  })
} catch (err) {
  res.send(err.message);
  return;
}
})

app.post('/login-user', async(req, res) => {
  const {email, password} = req.body.userDetails;
  let sql = `SELECT * from users WHERE email=?`;
  db.query(sql, email, async(err, result) => {
    if(err) throw err;
    if(result.length) {
      const userFound=JSON.parse(JSON.stringify(result[0]));
      if( await bcrypt.compare(password, userFound.password)) {
        const newCustomers = JSON.parse(userFound.customers);
        const user = {...userFound, token: generateToken(userFound.id), customers: newCustomers};
            res.send(user)
      } else {
        res.send("Not Authenticated");
      }
    }
  })
})

app.get('/get-user', async(req,res) => {
  const token = req.headers.authorization;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const sql = `SELECT * from users WHERE id=?`;
  db.query(sql, decoded.id, (err, result) => {
    if(err) throw err;
    const userFound=JSON.parse(JSON.stringify(result[0]));
    const newCustomers = JSON.parse(userFound.customers);
    const user = {...userFound, token: generateToken(userFound.id), customers: newCustomers};
    res.send(user);
  })
})

app.get('/forgot-password', async(req,res) => {
  const string = genRand(12);
  const hash = CryptoJS.SHA1(string);
  const result = CryptoJS.enc.Hex.stringify(hash);

  var mailOptions = {
    from: 'comltdhit@gmail.com',
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

https.createServer(options, app).listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});


// app.listen(PORT, () => {
//   console.log(`Server listening on ${PORT}`);
// });

const createTables = () => {
  let sql = 'CREATE TABLE IF NOT EXISTS users (id INT(11) NOT NULL AUTO_INCREMENT, email VARCHAR(50), password TEXT, customers JSON, primary key(id))';
  db.query(sql, (err, result) => {
    if(err){
      throw err;
    }
    console.log('Create users table success')
  })
}


const protect = async (req,res,next) => {
  let token;
  if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
          token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          let sql = `SELECT * from users WHERE id=?`;
          db.query(sql,decoded.id, (err, result) => {
            if(err){
              throw err;
            }
            req.user = result[0];
            next();
          })
      } catch(err) {
        console.log(err);
      }
  }
} 