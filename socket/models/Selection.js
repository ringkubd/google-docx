const { Schema, model } = require("mongoose")

const Selection = new Schema({
    _id: String,
    data: Object
})
module.exports = model("Selection", Selection)