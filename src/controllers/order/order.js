import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";


export const createOrder = async(req,reply)=>{
    try {
        const {userId}=req.user;
    const { items, branch, totalPrice, deliveryLocation: reqDeliveryLocation, pickupLocation: reqPickupLocation } = req.body;

    const customerData = await Customer.findById(userId);
    // Try resolving branch in multiple ways to be tolerant to client payloads
    let branchData = null;
    try {
      // if branch looks like an id or is an object with _id
      if (branch && typeof branch === 'object' && branch._id) {
        branchData = await Branch.findById(branch._id);
      } else if (branch) {
        branchData = await Branch.findById(branch);
      }
    } catch (e) {
      // ignore invalid ObjectId format errors
      branchData = null;
    }

    // fallback: if branchData not found and branch is a string, try matching by name
    if (!branchData && branch && typeof branch === 'string') {
      branchData = await Branch.findOne({ name: branch });
    }

        if(!customerData){
           return reply.status(404).send({ message: "Customer not found" });
        }

    if (!branchData) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // validate items
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ message: "Items are required to create an order" });
    }

    // build deliveryLocation: prefer request-provided, then customer's liveLocation
    const deliveryLocation = reqDeliveryLocation ?? (customerData.liveLocation && (customerData.liveLocation.latitude != null || customerData.liveLocation.longitude != null) ? {
      latitude: customerData.liveLocation.latitude,
      longitude: customerData.liveLocation.longitude,
      address: customerData.address || "No address available",
    } : (customerData.address ? { address: customerData.address } : null));

    // If still no deliveryLocation, allow creation only if address present
    if (!deliveryLocation || (!deliveryLocation.latitude && !deliveryLocation.longitude && !deliveryLocation.address)) {
      return reply.status(400).send({ message: "Delivery location is missing or incomplete" });
    }

    // build pickupLocation: prefer request-provided, then branch location
    const pickupLocation = reqPickupLocation ?? (branchData.location && (branchData.location.latitude != null || branchData.location.longitude != null) ? {
      latitude: branchData.location.latitude,
      longitude: branchData.location.longitude,
      address: branchData.address || "No address available",
    } : (branchData.address ? { address: branchData.address } : null));

    if (!pickupLocation || (!pickupLocation.latitude && !pickupLocation.longitude && !pickupLocation.address)) {
      return reply.status(400).send({ message: "Pickup location (branch) is missing or incomplete" });
    }

        const newOrder = new Order({
            customer:userId,
            items:items.map((item)=>({
                id:item.id,
                item:item.item,
                count:item.count
            })),
            branch: branchData._id,
            totalPrice,
      deliveryLocation: deliveryLocation,
      pickupLocation: pickupLocation,
        });

        let savedOrder = await newOrder.save();

        savedOrder = await savedOrder.populate([
            { path: "items.item" },
        ]);

        return reply.status(201).send(savedOrder);
 
    } catch (error) {
        console.log(error);
        return reply.status(500).send({ message: "Failed to create order", error });
    }
}

export const confirmOrder = async(req,reply)=>{
    try {
        const { orderId } = req.params;
        const { userId } = req.user;
        const { deliveryPersonLocation } = req.body;  
        
        const deliveryPerson = await DeliveryPartner.findById(userId);
        if (!deliveryPerson) {
            return reply.status(404).send({ message: "Delivery Person not found" });
        }
        const order = await Order.findById(orderId);
        if (!order) return reply.status(404).send({ message: "Order not found" });

        if (order.status !== "available") {
            return reply.status(400).send({ message: "Order is not available" });
          }
        
        order.status = "confirmed";

        order.deliveryPartner = userId;
        order.deliveryPersonLocation = {
          latitude: deliveryPersonLocation?.latitude,
          longitude: deliveryPersonLocation?.longitude,
          address: deliveryPersonLocation?.address || "",
        };

        req.server.io.to(orderId).emit('orderConfirmed',order);
        await order.save()
    
        return reply.send(order)

    } catch (error) {
      console.log(error)
        return reply
        .status(500)
        .send({ message: "Failed to confirm order", error });
    }
} 

export const updateOrderStatus=async(req,reply)=>{
    try {
        const { orderId } = req.params;
        const { status, deliveryPersonLocation } = req.body;
        const { userId } = req.user;

        const deliveryPerson = await DeliveryPartner.findById(userId);
        if (!deliveryPerson) {
          return reply.status(404).send({ message: "Delivery Person not found" });
        }
    
        const order = await Order.findById(orderId);
        if (!order) return reply.status(404).send({ message: "Order not found" });

        if (["cancelled", "delivered"].includes(order.status)) {
            return reply.status(400).send({ message: "Order cannot be updated" });
          }
        
        if (order.deliveryPartner.toString() !== userId) {
            return reply.status(403).send({ message: "Unauthorized" });
        }

        order.status = status;
        order.deliveryPersonLocation = deliveryPersonLocation;
        await order.save();

        req.server.io.to(orderId).emit("liveTrackingUpdates", order);

        return reply.send(order);
        
    } catch (error) {
        return reply
        .status(500)
        .send({ message: "Failed to update order status", error });
    }
}

export const getOrders = async (req, reply) => {
    try {
      const { status, customerId, deliveryPartnerId, branchId } = req.query;
      let query = {};
  
      if (status) {
        query.status = status;
      }
      if (customerId) {
        query.customer = customerId;
      }
      if (deliveryPartnerId) {
        query.deliveryPartner = deliveryPartnerId;
        query.branch = branchId;
      }
  
      const orders = await Order.find(query).populate(
        "customer branch items.item deliveryPartner"
      );
  
      return reply.send(orders);
    } catch (error) {
      return reply
        .status(500)
        .send({ message: "Failed to retrieve orders", error });
    }
  };

export const getOrderById = async (req, reply) => {
    try {
      const { orderId } = req.params;
  
      const order = await Order.findById(orderId).populate(
        "customer branch items.item deliveryPartner"
      );
  
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }
  
      return reply.send(order);
    } catch (error) {
      return reply
        .status(500)
        .send({ message: "Failed to retrieve order", error });
    }
  };
  