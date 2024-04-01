import express from 'express'
import bodyParser from 'body-parser'
import Mail from './mail.js'

const appMailer = express()

appMailer.use(bodyParser.json())

appMailer.get('/', (req, res) => {
    res.send(`Req from ${req.hostname} : <h1>Hello</h1>`)
}) 

appMailer.post('/mail', async (req, res) => {
    const {email, message} = req.body
    return res.json({result: await Mail.send(email, message)})
})

appMailer.listen(process.env.PORT || 3000, () => {
    console.log(`Server is run on port : 3000`)
})