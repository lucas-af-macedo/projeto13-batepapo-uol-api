import express,{ json } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import joi from 'joi'
import dayjs from 'dayjs'
import { stripHtml } from "string-strip-html"

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
    let objectParticipant = req.body

    if(validation.error){
        const errors = validation.error.details.map((detail)=>detail.message)
        res.status(422).send(errors)
        return;
    }

    objectParticipant.name = stripHtml(req.body.name).result.trim()

    try{
        const isLogged = await db.collection("participants").find({
            name:objectParticipant.name
        }).toArray()

        if (isLogged.length){
            res.status(409).send('usuario ja logado')
            return
        }

        await db.collection("participants").insertOne({
            name: objectParticipant.name,
            lastStatus: Date.now()
        });

        await db.collection("messages").insertOne({
            from: objectParticipant.name,
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

    let objectMenssage = req.body

    if(validation.error){
        const errors = validation.error.details.map((detail)=>detail.message)
        res.status(422).send(errors)
        return;
    }

     Object.keys(req.body).forEach((key)=>(
        objectMenssage[key] = stripHtml(req.body[key]).result.trim()))

    try{
        const userLogged = await db.collection('participants').findOne({
            name: user
        })

        if(userLogged){
            await db.collection('messages').insertOne({
                from: user,
                time: now.format('HH:mm:ss'),
                ...objectMenssage
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

app.delete('/messages/:id', async (req, res) =>{
    const id = req.params.id
    const user = req.headers.user

    try{
        const message = await db.collection('messages').findOne({_id: ObjectId(id)})

        if (message){
            if(user===message.from){
                await db.collection('messages').deleteOne({_id: ObjectId(id)})
            }else{
                res.sendStatus(401)
            }
        }else{
            res.sendStatus(404)
        }

    } catch (err){
        console.log(err)
        res.sendStatus(500)
    }
})

app.put('/messages/:id', async (req, res) =>{
    const validation = postMessageSchema.validate(req.body,{abortEarly: false})
    const user = req.headers.user
    const {id} = req.params
    let objectMenssage = req.body

    if(validation.error){
        const errors = validation.error.details.map((detail)=>detail.message)
        res.status(422).send(errors)
        return;
    }

    Object.keys(req.body).forEach((key)=>(
        objectMenssage[key] = stripHtml(req.body[key]).result.trim()))

    try{
        const message = await db.collection('messages').findOne({_id: ObjectId(id)})

        if (message){
            if(user===message.from){
                await db.collection('messages').updateOne({
                    _id: message._id
                },{
                    $set: objectMenssage
                })
            }else{
                res.sendStatus(401)
            }
        }else{
            res.sendStatus(404)
        }

    } catch (err){
        console.log(err)
        res.sendStatus(500)
    }

    res.sendStatus(201)
})

app.listen(5000);