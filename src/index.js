const express = require('express')
const btsRouter = require('./routers/bts')

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(btsRouter)

app.listen(port, () => {
    console.log('Server is up on port ' + port)
})


