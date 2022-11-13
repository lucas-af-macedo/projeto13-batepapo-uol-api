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

const postMessageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid('message','private_message')
})

setInterval(async ()=>{
    const now = dayjs()
    const date = Date.now()
    const timeInative = 10000

    try{
        const users = await db.collection("participants").find({}).toArray()

        for (let i = 0;i < users.length;i++){
            const timeDiference = date - users[i].lastStatus

            if(timeInative<timeDiference){
                await db.collection('participants').deleteOne({_id: users[i]._id})
                await db.collection("messages").insertOne({
                    from: users[i].name,
                    to: 'todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: now.format('HH:mm:ss')
                });
            }
        }
    } catch (err){
        console.log(err)
    }

    
},15000)

function listMessagesWithLimit(messages, limit, user){
    let messagesArray = []

    const limitNumber = Number(limit)
    for (let i=messages.length-1;i>=0;i--){
        const isPrivate = messages[i].type === 'private_message'
        const isUserConversation = messages[i].from === user || messages[i].to === user

        if(isPrivate){
            if(!isUserConversation){
                continue;
            }
        }

        messagesArray = [messages[i],...messagesArray]
        if(messagesArray.length===limitNumber){
            return(messagesArray)
        }
    }
    return(messagesArray)
}

function listMessages(messages, user){
    let messagesArray = []

    for (let i = messages.length-1; i >= 0; i--){
        const isPrivate = messages[i].type === 'private_message'
        const isUserConversation = messages[i].from === user || messages[i].to === user

        if(isPrivate){
            if(!isUserConversation){
                continue;
            }
        }

        messagesArray = [messages[i],...messagesArray]
    }
    return(messagesArray)
}

app.get('/participants', async (req, res) =>{
    try{
        const users = await db.collection("participants").find({}).toArray()
        res.status(200).send(users)
        return
    } catch (err){
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/messages:limit?', async (req, res) =>{
    const limit = req.query.limit
    const user = req.headers.user
    let messagesArray = []

    try{
        const messages = await db.collection("messages").find({}).toArray()
        if(limit!==undefined){
            messagesArray = listMessagesWithLimit(messages, limit, user)
        }else{
            messagesArray = listMessages(messages, user)
        }

        res.status(200).send(messagesArray)
        return
    } catch (err){
        console.log(err)
        res.sendStatus(500)
    }
})


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

    } catch(err){
        console.log(err)
        res.sendStatus(500)
    }

    res.sendStatus(201)
})

app.post('/messages', async (req, res) =>{
    const validation = postMessageSchema.validate(req.body,{abortEarly: false})
    const user = req.headers.user
    const now = dayjs()

    if(validation.error){
        const errors = validation.error.details.map((detail)=>detail.message)
        res.status(422).send(errors)
        return;
    }

    try{
        const userLogged = await db.collection('participants').find({
            name: user
        }).toArray()

        if(userLogged.length){
            await db.collection('messages').insertOne({
                from: user,
                time: now.format('HH:mm:ss'),
                ...req.body
            })

        }else{
            res.status(422).send('usuario nao logado')
            return;
        }

    } catch (err){
        console.log(err)
        res.sendStatus(500)
    }

    res.sendStatus(201)
})

app.post('/status', async (req, res) =>{
    const user = req.headers.user

    try{
        const userLogged = await db.collection('participants').findOne({name:user})

        if(!userLogged){
            res.sendStatus(404)
            return
        }

        await db.collection('participants').updateOne({
            _id: userLogged._id
        },{
            $set:{
                lastStatus: Date.now()
            }
        })

    } catch(err){
        console.log(err)
        res.sendStatus(500)
    }
    res.sendStatus(200)
})

app.listen(5000);