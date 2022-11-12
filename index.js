import express,{ json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from 'joi'
import dayjs from 'dayjs'

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
	db = mongoClient.db("batepapo-uol"); 
});


const postParticipantSchema = joi.object({
    name: joi.string().required()
})

setInterval(async ()=>{
    const users = await db.collection("participants").find({}).toArray()

    console.log(users)
},15000)

/*app.get('/participants', async (req, res) =>{
    console.log('oi')
    /*db.collection("users").insertOne({
        email: "joao@email.com",
        password: "minha_super_senha"
    });
    res.sendStatus(200)
})

app.get('/messages', async (req, res) =>{
    console.log(req)
})*/


app.post('/participants', async (req, res) =>{
    const validation = postParticipantSchema.validate(req.body,{abortEarly: false})
    const now = dayjs()

    if(validation.error){
        const errors = validation.error.details.map((detail)=>detail.message)
        res.status(422).send(errors)
        return;
    }

    try{
        const isLogged = await db.collection("participants").find({
            name:req.body.name
        }).toArray()

        if (isLogged.length){
            res.status(409).send('usuario ja logado')
            return
        }

        await db.collection("participants").insertOne({
            name: req.body.name,
            lastStatus: Date.now()
        });

        await db.collection("messages").insertOne({
            from: req.body.name,
            to: 'todos',
            text: 'entou na sala...',
            type: 'status',
            time: now.format('HH:mm:ss')
        });

    } catch{
        res.sendStatus(500)
    }

    res.sendStatus(201)
})

/*app.post('/messages', async (req, res) =>{
    console.log(req)
})

app.post('/status', async (req, res) =>{
    console.log(req)
})*/

app.listen(5000);