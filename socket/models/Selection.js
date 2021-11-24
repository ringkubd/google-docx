const { Schema, model } = require("mongoose")

const Selection = new Schema({
    _id: String,
    user: String,
    data: Object
})
module.exports = model("Selection", Selection)