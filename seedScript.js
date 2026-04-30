import "dotenv/config.js";
import mongoose from "mongoose";
import { Category, Product, Admin } from "./src/models/index.js";
import { categories, products } from "./seedData.js";


async function seedDatabase() {
    try{
        await mongoose.connect(process.env.MONGO_URI);
        await Product.deleteMany({});
        await Category.deleteMany({});

        const categoryDocs = await Category.insertMany(categories);

        const categoryMap = categoryDocs.reduce((map,category)=>{
            map[category.name]=category._id;
            return map
        },{})

        const productWithCategoryIds = products.map((product) => ({
            ...product,
            category: categoryMap[product.category],
          }));

        await Product.insertMany(productWithCategoryIds);

        // Create an Admin user if it doesn't exist (use env vars if provided)
        const adminEmail = process.env.ADMIN_EMAIL || "ritik@gmail.com";
        const adminPassword = process.env.ADMIN_PASSWORD || "12345678";
        const existingAdmin = await Admin.findOne({ email: adminEmail });
        if (!existingAdmin) {
            await Admin.create({
                name: "Admin",
                email: adminEmail,
                password: adminPassword,
                role: "Admin",
                isActivated: true,
            });
            console.log(`ADMIN CREATED: ${adminEmail}`);
        } else {
            console.log(`ADMIN ALREADY EXISTS: ${adminEmail}`);
        }

        console.log("DATABASE SEEDED SUCCESSFULLY ✅")
    }
    catch (error) {
        console.error("Error Seeding database:", error);
    } finally {
        mongoose.connection.close();
    }
}

seedDatabase();