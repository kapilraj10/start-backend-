import "dotenv/config.js";
import mongoose from "mongoose";
import { DeliveryPartner } from "../src/models/user.js";
import Branch from "../src/models/branch.js";

async function createDeliveryPartner(){
    try{
        await mongoose.connect(process.env.MONGO_URI);
        const branchName = "dang tulisipur";
        const branch = await Branch.findOne({ name: branchName });
        if(!branch){
            console.error(`Branch not found: ${branchName}`);
            process.exit(1);
        }

        const email = process.env.DELIVERY_EMAIL || "dp1@example.com";
        const existing = await DeliveryPartner.findOne({ email });
        if(existing){
            console.log(`DeliveryPartner already exists: ${email}`);
            // ensure branch link
            if(!branch.deliveryPartners.includes(existing._id)){
                branch.deliveryPartners.push(existing._id);
                await branch.save();
                console.log("Linked existing delivery partner to branch");
            }
            return process.exit(0);
        }

        const dp = await DeliveryPartner.create({
            name: "DP One",
            email,
            password: process.env.DELIVERY_PASSWORD || "password123",
            phone: 9999999999,
            role: "DeliveryPartner",
            isActivated: true,
            liveLocation: {
                latitude: branch.location?.latitude || 26.8467,
                longitude: branch.location?.longitude || 80.9462,
            },
            address: branch.address || "Dang Tulisipur, Example Road, City",
            branch: branch._id,
        });

        branch.deliveryPartners.push(dp._id);
        await branch.save();

        console.log("Created DeliveryPartner:", dp);
        process.exit(0);
    }catch(err){
        console.error(err);
        process.exit(1);
    }
}

createDeliveryPartner();
