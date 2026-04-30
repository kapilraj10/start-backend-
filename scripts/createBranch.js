import "dotenv/config.js";
import mongoose from "mongoose";
import Branch from "../src/models/branch.js";

async function createBranch(){
    try{
        await mongoose.connect(process.env.MONGO_URI);
        const name = "dang tulisipur";
        const existing = await Branch.findOne({name});
        if(existing){
            console.log(`Branch already exists: ${name}`);
            return process.exit(0);
        }
        const branch = await Branch.create({
            name,
            location: {
                latitude: 26.8467, // example nearby coordinates (adjust as needed)
                longitude: 80.9462,
            },
            address: "Dang Tulisipur, Example Road, City",
        });
        console.log("Created branch:", branch);
        process.exit(0);
    }catch(err){
        console.error(err);
        process.exit(1);
    }
}

createBranch();
