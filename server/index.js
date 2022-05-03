const express = require("express");
const cors = require('cors')
const mysql = require("mysql");
const bcrypt = require("bcryptjs/dist/bcrypt");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());
app.use(cors())

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

      db.query(`INSERT INTO users VALUES (?,?)`, [email, hashedPassword], (err, result)=>{
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
        res.status(400).send("Not Authenticated");
      }
    }
  })
})

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

const createTables = () => {
  let sql = 'CREATE TABLE IF NOT EXISTS users (email VARCHAR(50), password TEXT)';
  db.query(sql, (err, result) => {
    if(err){
      throw err;
    }
    console.log('Create users table success')
  })
}